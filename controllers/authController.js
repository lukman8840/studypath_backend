const Joi = require("joi");
const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const NodemailerTransporter = require("../middlewares/NodeMailer");

const WellLinkLogin = "https://well-link.netlify.app/login";
const handleErrors = (err) => {
  let errors = { message: "", status: 400 };

  if (err.code === 11000) {
    errors.message = "This email is already registered";
    return errors;
  }

  // Handle OAuth token errors
  if (err.message?.includes("invalid_grant") || err.message?.includes("Token has been expired")) {
    errors.message = "Email service authentication failed. Please contact support.";
    errors.status = 503; // Service Unavailable
    return errors;
  }

  if (/email|password/i.test(err.message)) {
    errors.message = "Invalid email or password";
  } else {
    errors.message = "An unknown error occurred";
  }

  return errors;
};

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// Signup controller
exports.Signup_post = async (req, res) => {
  const { body } = req;
  const JoiSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required().min(6).max(16),
    role: Joi.string().required(),
    fullname: Joi.string().required(),
  });

  const { value, error } = JoiSchema.validate(body);

  // console.log(error);
  if (error) {
    const errors = handleErrors(error);
    return res.status(422).json({ errors, data: value, success: false });
  }

  try {
    // Check if email already exists
    const emailExist = await User.findOne({ email: value.email });
    if (emailExist) {
      const errors = handleErrors({ code: 11000 });
      return res.status(500).json({ errors, data: null, success: false });
    }

    // Validate and send email
    const EmailOptions = {
      from: process.env.EMAIL_ADDRESS,
      to: value.email,
      subject: "Welcome to WellLink – Confirm Your Email",
      html: `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px; border: 1px solid #ddd; border-radius: 10px; max-width: 600px; margin: auto;">
      <h2 style="text-align: center; color: #3e98c7;">Welcome to WellLink!</h2>
      <p>Congratulations! Your account has been successfully activated. You’re all set to log in and start enjoying all the great features WellLink has to offer.</p>
      <p style="text-align: center;">
        <a href="${WellLinkLogin}" style="background-color: #3e98c7; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Log in to WellLink</a>
      </p>
      <p>If the button above doesn't work, copy and paste the following link into your browser:</p>
      <p><a href="${WellLinkLogin}">${WellLinkLogin}</a></p>
      <p>Thank you for joining us!<br>– The WellLink Team</p>
    </div>
  `,
    };

    async function isEmailValid() {
      try {
        const mailInfo = await NodemailerTransporter.sendMail(EmailOptions);
        console.log("mailInfo", mailInfo);
        return mailInfo;
      } catch (emailError) {
        console.log("emailError", emailError);
        const errors = handleErrors(emailError); // Pass the actual error object
        return res.status(errors.status).json({
          errors,
          data: null,
          success: false,
        });
      }
    }

    const isEmailSent = await isEmailValid();

    if (isEmailSent?.messageId) {
      // Create user
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(value.password, salt);

      const user = await User.create({
        email: value.email,
        password: hashedPassword,
        role: value.role,
        fullname: value.fullname,
      });

      const token = generateToken(user._id);

      return res.status(200).json({
        message: "Signup successful",
        data: {
          user: {
            email: user.email,
            id: user.id,
            role: user.role,
            fullname: user.fullname,
          },
        },
        success: true,
        jwt: token,
      });
    }
  } catch (error) {
    const errors = handleErrors(error);
    return res.status(errors.status).json({ errors, success: false });
  }
};

// Login controller
exports.Login_post = async (req, res) => {
  const { body } = req;

  const JoiSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required().min(6).max(16),
  });

  const { value, error } = JoiSchema.validate(body);

  if (error) {
    const errors = handleErrors(error);
    return res.status(422).json({ errors, data: value, success: false });
  }

  try {
    const user = await User.login(value.email, value.password);
    const token = generateToken(user._id);

    res.status(200).json({
      message: "Login successful",
      data: {
        user: {
          email: user.email,
          id: user._id,
          role: user.role,
          fullname: user.fullname,
        },
      },
      success: true,
      jwt: token,
    });
  } catch (error) {
    const errors = handleErrors(error);
    console.log(errors);
    res.status(errors.status).json(errors);
  }
};
