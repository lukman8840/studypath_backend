const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.API);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const Record = require("../models/userRecord");
const User = require("../models/userModel");
const mongoose = require("mongoose");
const NodemailerTransporter = require("../middlewares/NodeMailer");

const WellLink_URL = "https://well-link.netlify.app";

module.exports.LogginSymptoms = async (req, res) => {
  const { age, gender, known_allergies, smoker, chronic_conditions, userId, symptoms } = req.body;
  // console.log(req.body);
  if (!age || !gender || !known_allergies || !chronic_conditions || !userId || !smoker || !symptoms) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  try {
    const prompt = `
    You are a helpful AI Health Assistant designed to provide personalized health insights based on a user's submitted data. STRICT JSON FORMATTING RULES:
    1. Provide your response as a valid RFC8259 compliant JSON object.
    2. Use double quotes (\\") for all keys and string values.
    3. Escape all special characters, especially double quotes (\\") and backslashes (\\\\).
    4. Ensure all objects and arrays are properly closed.
    5. Ensure that the JSON object or array is properly enclosed within curly braces {} or square brackets [], respectively.
    6. Ensure to escape all break lines. Ensure that break lines within a long string are escaped.
    7. Ensure JSON that contains nested objects or arrays are properly formatted and closed.
    8. Separate elements within arrays and key-value pairs with commas. Avoid trailing commas.
    9. Use true or false (lowercase, no quotes) for boolean values.
    10. Do not truncate or omit any part of the JSON structure.
    11. Be aware of this error that might come, do all you can to generate well-formatted JSON to prevent this error: Unexpected end-of-input: was expecting closing quote for a string value.
    12. Do not add any text before or after the JSON object.

    The user provides the following information:
    - Age: ${age}
    - Gender: ${gender}
    - Chronic Conditions: ${chronic_conditions} (e.g., Asthma, Type 2 Diabetes)
    - Known Allergies: ${known_allergies} (e.g., Penicillin, Pollen)
    - Smoker: ${smoker}
    - Symptoms: ${symptoms}

    Your task is to generate a response in the following format, strictly adhering to JSON formatting:

    {
        "symptoms": "described symptoms based on input",
        "overall_status": "[Stable / Caution / High Risk]",
        "prescribe_medication": "medication 1, medication 2 or simple remedies like 'hydration, rest'",
        "recommendations": "recommendations here without any mention of medications",
        "next_steps": "next step here"
    }

    **Important Rules:**
    - Ensure that any medication or remedies are only included in the "prescribe_medication" field.
    - If a remedy (e.g., hydration, rest) is suitable, include it in "prescribe_medication."
    - Ensure that medication is provided if symptoms indicate it is necessary. If not needed, set "prescribe_medication" to "None".
    - Recommendations should only include non-medication advice such as lifestyle tips or monitoring suggestions.
    - Ensure the output JSON format is well-structured and compliant with all rules.

    Your response must strictly follow these rules and must be in JSON format only. Do not include anything before or after the JSON.
`;

    const result = await model.generateContent(prompt);
    const responseGemini = await result.response;
    const text = responseGemini.text();

    const record = await Record.create({
      userId,
      response: JSON.parse(text),
    });

    if (record) {
      res.status(200).json({ text });
    } else {
      res.status(500).json({ message: "Failed to stored record" });
    }
  } catch (error) {
    console.log("API_ERROR", error);
    if (error.status === 503) {
      res.status(503).json({ message: "Our Ai servers are experiencing high traffic. Try again soon." });
      return;
    }

    res.status(500).json({ message: "Failed please try again" });
  }
};

module.exports.GetRecords = async function (req, res) {
  try {
    const records = await Record.find();
    res.status(200).json({ data: records });
  } catch (error) {
    res.status(400).json({ error });
  }
};

module.exports.GetRecordsById = async function (req, res) {
  const userId = req.params.id;
  const { status } = req.query;

  try {
    let query = { userId };
    if (status && status !== "all") {
      query["response.overall_status"] = status;
    }
    const records = await Record.find(query);
    res.status(200).json({ data: records });
  } catch (error) {
    res.status(400).json({ error });
  }
};

module.exports.GetRecordsStats = async function (req, res) {
  const userId = req.params.id;
  try {
    // Get total count of records
    const totalRecords = await Record.countDocuments({ userId });
    // Get count by status
    const statusCounts = await Record.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: "$response.overall_status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get records by date (last 7 days)
    // const last7DaysRecords = await Record.aggregate([
    //   {
    //     $match: {
    //       userId: userId,
    //       createdAt: {
    //         $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    //       },
    //     },
    //   },
    //   {
    //     $group: {
    //       _id: {
    //         $dateToString: {
    //           format: "%Y-%m-%d",
    //           date: "$createdAt",
    //         },
    //       },
    //       count: { $sum: 1 },
    //     },
    //   },
    //   { $sort: { _id: 1 } },
    // ]);

    // Get most common symptoms
    const commonSymptoms = await Record.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: "$response.symptoms",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    res.status(200).json({
      data: {
        totalRecords,
        statusCounts,
        // last7DaysRecords,
        commonSymptoms,
      },
    });
  } catch (error) {
    res.status(400).json({ error });
  }
};

module.exports.GetPatients = async function (req, res) {
  const { search, status } = req.query;

  try {
    let query = { role: "patient" };
    if (search) {
      query.$or = [{ fullname: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }];
    }

    const patients = await User.find(query).select("-password").sort({ createdAt: -1 });

    if (status) {
      const records = await Record.find({
        userId: { $in: patients.map((p) => p._id) },
        "response.overall_status": status,
      });

      const latestRecords = records.reduce((acc, record) => {
        const existingRecord = acc[record.userId];
        if (!existingRecord || record.createdAt > existingRecord.createdAt) {
          acc[record.userId] = record;
        }
        return acc;
      }, {});

      const filteredPatients = patients.filter(
        (patient) => latestRecords[patient._id]?.response.overall_status === status
      );

      return res.status(200).json({
        data: filteredPatients.map((patient) => ({
          ...patient.toObject(),
          latestRecord: latestRecords[patient._id],
        })),
      });
    }

    const latestRecords = await Record.aggregate([
      {
        $match: {
          userId: { $in: patients.map((p) => p._id.toString()) },
          "response.isScheduled": "true",
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: "$userId",
          latestRecord: { $first: "$$ROOT" },
        },
      },
    ]);

    const recordsMap = latestRecords.reduce((acc, { _id, latestRecord }) => {
      acc[_id] = latestRecord;
      return acc;
    }, {});

    // Filter out patients without a latest record
    const patientsWithRecords = patients
      .filter((patient) => recordsMap[patient._id.toString()] !== undefined)
      .map((patient) => ({
        ...patient.toObject(),
        latestRecord: recordsMap[patient._id.toString()],
      }));

    res.status(200).json({
      data: patientsWithRecords,
      total: patientsWithRecords.length,
    });
  } catch (error) {
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

module.exports.UpdateOverallStatus = async function (req, res) {
  const { recordId } = req.params;
  const { overall_status, isScheduled } = req.body;
  try {
    // Validate input
    if (!overall_status) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Overall Status is required",
      });
    }

    const cleanRecordId = recordId.trim().replace(":", "");

    // Prepare update object
    const updateFields = {
      "response.overall_status": overall_status,
      updatedAt: new Date(),
    };

    // Add isScheduled if provided
    if (isScheduled !== undefined) {
      updateFields["response.isScheduled"] = isScheduled.toString();
    }

    // Find and update the record
    const updatedRecord = await Record.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(cleanRecordId) },
      { $set: updateFields },
      {
        new: true, // Return the updated document
        runValidators: true, // Run schema validators
      }
    );

    // Check if record exists
    if (!updatedRecord) {
      return res.status(404).json({
        error: "Not Found",
        message: "Record not found",
      });
    }

    // Return success response
    res.status(200).json({
      message: "Status updated successfully",
      data: updatedRecord,
    });
  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message,
    });
  }
};

module.exports.DeleteRecord = async function (req, res) {
  const recordId = req.params.id;

  try {
    // Find record before deletion to check if it exists
    const existingRecord = await Record.findById(recordId);

    if (!existingRecord) {
      return res.status(404).json({
        errors: {
          message: "Record not found",
          status: 404,
        },
        data: null,
        success: false,
      });
    }

    // Perform the deletion
    const deletedRecord = await Record.findByIdAndDelete(recordId);

    if (deletedRecord) {
      return res.status(200).json({
        data: {
          message: "Record successfully deleted",
          deletedRecord,
        },
        success: true,
      });
    } else {
      return res.status(400).json({
        errors: {
          message: "Failed to delete record",
          status: 400,
        },
        data: null,
        success: false,
      });
    }
  } catch (error) {
    // Handle invalid ObjectId format
    if (error.name === "CastError") {
      return res.status(400).json({
        errors: {
          message: "Invalid record ID format",
          status: 400,
        },
        data: null,
        success: false,
      });
    }

    return res.status(500).json({
      errors: {
        message: error.message || "An error occurred while deleting the record",
        status: 500,
      },
      data: null,
      success: false,
    });
  }
};

module.exports.UpdateDoctorApproval = async function (req, res) {
  const { recordId } = req.params;
  const { doctors_approval, overall_status, prescribe_medication } = req.body;

  try {
    // Validate inputs
    if (doctors_approval === undefined) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Doctors approval status is required",
      });
    }

    // Validate that the status is boolean
    if (typeof doctors_approval !== "boolean") {
      return res.status(400).json({
        error: "Bad Request",
        message: "Doctors approval status must be true or false",
      });
    }

    // Remove any potential leading/trailing whitespace and colons
    const cleanRecordId = recordId.trim().replace(":", "");

    // Create update object
    const updateData = {
      $set: {
        "response.doctor_approved": doctors_approval,
        updatedAt: new Date(),
      },
    };

    // Add optional fields
    if (prescribe_medication) {
      updateData.$set["response.prescribe_medication"] = prescribe_medication;
    }

    if (overall_status) {
      updateData.$set["response.overall_status"] = overall_status;
    }

    // Find the record first to get patient email if needed
    const existingRecord = await Record.findById(cleanRecordId);
    const findUser = await User.findById(existingRecord.userId);

    if (!existingRecord) {
      return res.status(404).json({
        error: "Not Found",
        message: `Record not found with ID: ${cleanRecordId}`,
      });
    }

    // Send email only if doctors_approval is true
    if (doctors_approval) {
      const EmailOptions = {
        from: process.env.EMAIL_ADDRESS,
        to: findUser.email,
        subject: "Doctor Approval Notification",
        html: `
           <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f4f7f9; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <div style="background-color: #3e98c7; color: white; padding: 20px; text-align: center; border-top-left-radius: 10px; border-top-right-radius: 10px;">
        <h1 style="margin: 0; font-size: 24px;">Medical Record Approval</h1>
      </div>
      
      <div style="background-color: white; padding: 30px; border-bottom-left-radius: 10px; border-bottom-right-radius: 10px;">
        <p style="color: #333; line-height: 1.6; font-size: 16px;">
          Dear ${findUser.fullname || "Patient"},
        </p>
        
        <p style="color: #2c3e50; line-height: 1.6; font-size: 16px;">
          We are pleased to inform you that your medical record has been reviewed and approved by our medical professional.
        </p>
        
        <div style="background-color: #e8f4f8; border-left: 4px solid #3e98c7; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #2c3e50; font-weight: bold;">
            Status: <span style="color: #27ae60;">Approved</span>
          </p>
        </div>
        
        <p style="color: #7f8c8d; line-height: 1.6; font-size: 14px; margin-top: 20px;">
          If you have any questions or need further information, please contact our medical support team.
        </p>
        
        <div style="text-align: center; margin-top: 30px;">
          <a href=${WellLink_URL} style="background-color: #3e98c7; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">
            View Details
          </a>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 20px; color: #7f8c8d; font-size: 12px;">
        <p>© 2024 WellLink Health Services. All rights reserved.</p>
      </div>
    </div>
        `,
      };

      try {
        await NodemailerTransporter.sendMail(EmailOptions);
      } catch (emailError) {
        console.error("Email sending failed:", emailError);
        // Optionally, you might want to handle email sending failure differently
      }
    }

    // Update the record
    const updatedRecord = await Record.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(cleanRecordId) },
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    res.status(200).json({
      message: "Doctor's approval status updated successfully",
      data: updatedRecord,
    });
  } catch (error) {
    console.error("Error updating doctor's approval:", error);
    console.error("Record ID that caused error:", recordId);

    res.status(500).json({
      error: "Internal Server Error",
      message: error.message,
    });
  }
};

module.exports.GetUsers = async function (req, res) {
  const { status, name } = req.query;

  try {
    // Base query for finding users
    let query = {};

    // Filter by name (case-insensitive, matches full name or partial name)
    if (name) {
      query.$or = [{ fullname: { $regex: name, $options: "i" } }, { email: { $regex: name, $options: "i" } }];
    }

    // Filter by role/status if provided
    if (status) {
      query.role = status;
    }

    // Find users based on query, exclude password
    const records = await User.find(query).select("-password");

    res.status(200).json({
      data: records,
      total: records.length,
    });
  } catch (error) {
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message,
    });
  }
};
