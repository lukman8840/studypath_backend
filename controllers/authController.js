const Joi = require("joi");
const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const NodemailerTransporter = require("../middlewares/NodeMailer");

const WellLinkLogin = "https://well-link.netlify.app";
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
// exports.Signup_post = async (req, res) => {
//   const { body } = req;
//   const JoiSchema = Joi.object({
//     email: Joi.string().email().required(),
//     password: Joi.string().required().min(6).max(16),
//     role: Joi.string().required(),
//     fullname: Joi.string().required(),
//   });

//   const { value, error } = JoiSchema.validate(body);

//   // console.log(error);
//   if (error) {
//     const errors = handleErrors(error);
//     return res.status(422).json({ errors, data: value, success: false });
//   }

//   try {
//     // Check if email already exists
//     const emailExist = await User.findOne({ email: value.email });
//     if (emailExist) {
//       const errors = handleErrors({ code: 11000 });
//       return res.status(500).json({ errors, data: null, success: false });
//     }

//     // Validate and send email
//     const EmailOptions = {
//       from: process.env.EMAIL_ADDRESS,
//       to: value.email,
//       subject: "Welcome to WellLink – Confirm Your Email",
//       html: `
//       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f4f7f9; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
//         <div style="background-color: #3e98c7; color: white; padding: 20px; text-align: center; border-top-left-radius: 10px; border-top-right-radius: 10px;">
//           <h1 style="margin: 0; font-size: 24px;">Welcome to WellLink!</h1>
//         </div>
      
//         <div style="background-color: white; padding: 30px; border-bottom-left-radius: 10px; border-bottom-right-radius: 10px;">
//           <p style="color: #333; line-height: 1.6; font-size: 16px;">
//             Congratulations! Your account has been successfully activated. You’re all set to log in and start enjoying all the great features WellLink has to offer.
//           </p>
      
//           <div style="text-align: center; margin: 20px 0;">
//             <a href="${WellLinkLogin}" style="background-color: #3e98c7; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
//               Log in to WellLink
//             </a>
//           </div>
      
//           <p style="color: #7f8c8d; line-height: 1.6; font-size: 14px; margin-top: 20px;">
//             If the button above doesn't work, copy and paste the following link into your browser:
//           </p>
//           <p>
//             <a href="${WellLinkLogin}" style="color: #3e98c7;">${WellLinkLogin}</a>
//           </p>
          
//           <p style="color: #333; line-height: 1.6; font-size: 16px;">
//             Thank you for joining us!<br>– The WellLink Team
//           </p>
//         </div>
      
//         <div style="text-align: center; margin-top: 20px; color: #7f8c8d; font-size: 12px;">
//           <p>© 2024 WellLink Health Services. All rights reserved.</p>
//         </div>
//       </div>`,
//     };

//     async function isEmailValid() {
//       try {
//         const mailInfo = await NodemailerTransporter.sendMail(EmailOptions);
//         return mailInfo;
//       } catch (emailError) {
//         const errors = handleErrors(emailError); // Pass the actual error object
//         return res.status(errors.status).json({
//           errors,
//           data: null,
//           success: false,
//         });
//       }
//     }

//     const isEmailSent = await isEmailValid();

//     if (isEmailSent?.messageId) {
//       // Create user
//       const salt = await bcrypt.genSalt(10);
//       const hashedPassword = await bcrypt.hash(value.password, salt);

//       const user = await User.create({
//         email: value.email,
//         password: hashedPassword,
//         role: value.role,
//         fullname: value.fullname,
//       });

//       const token = generateToken(user._id);

//       return res.status(200).json({
//         message: "Signup successful",
//         data: {
//           user: {
//             email: user.email,
//             id: user.id,
//             role: user.role,
//             fullname: user.fullname,
//           },
//         },
//         success: true,
//         jwt: token,
//       });
//     }
//   } catch (error) {
//     const errors = handleErrors(error);
//     return res.status(errors.status).json({ errors, success: false });
//   }
// };

exports.Signup_post = async (req, res) => {
  const { email, password, fullname, role } = req.body;

  const JoiSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(16).required(),
    role: Joi.string().required(),
    fullname: Joi.string().required(),
  });

  const { error } = JoiSchema.validate(req.body);
  if (error) {
    return res.status(422).json({
      errors: { message: error.details[0].message, status: 422 },
      data: null,
      success: false,
    });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        errors: { message: "Email already exists", status: 400 },
        data: null,
        success: false,
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      email,
      password: hashedPassword,
      fullname,
      role,
    });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    return res.status(201).json({
      message: "Signup successful",
      data: {
        user: {
          id: user._id,
          email: user.email,
          fullname: user.fullname,
          role: user.role,
        },
      },
      jwt: token,
      success: true,
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({
      errors: { message: "Server error", status: 500 },
      data: null,
      success: false,
    });
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
