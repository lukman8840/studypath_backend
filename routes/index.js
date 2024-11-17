var express = require("express");
var router = express.Router();

const axios = require("axios");
/* GET home page. */

const { GoogleGenerativeAI } = require("@google/generative-ai");
// Access your API key as an environment variable (see "Set up your API key" above)
const genAI = new GoogleGenerativeAI(process.env.API);

// The Gemini 1.5 models are versatile and work with both text-only and multimodal prompts
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// The Gemini 1.5 models are versatile and work with both text-only and multimodal prompts
router.get("/", function (req, res, next) {});

router.post("/learn", async function (req, res, next) {
  const { topic, level } = req.body;

  if (!topic || !level) {
    return res.status(400).json({
      success: false,
      error: "Topic and level are required",
    });
  }

  try {
    const prompt = `
      You are a helpful assistant that helps teach ${level} level students.
      Generate a structured learning path for the topic "${topic}".
      Provide at least 5 sequential learning tasks.
      
      Respond ONLY with a JSON array of objects with this structure:
      [
        {
          "id": "1",
          "title": "Clear, actionable learning task title",
          "link": "URL to reliable learning resource"
        }
      ]
      
      Ensure each task builds upon previous knowledge and links to reputable educational resources.
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    // Extract JSON from the response text
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("Invalid response format");
    }

    let parsedTasks;
    try {
      parsedTasks = JSON.parse(jsonMatch[0]);

      // Validate the structure of each task
      const isValidStructure = parsedTasks.every(
        (task) =>
          typeof task.id === "string" &&
          typeof task.title === "string" &&
          typeof task.link === "string" &&
          task.link.startsWith("http")
      );

      if (!isValidStructure) {
        throw new Error("Invalid task structure");
      }
    } catch (parseError) {
      throw new Error("Failed to parse learning tasks");
    }

    return res.status(200).json({
      success: true,
      data: {
        topic,
        level,
        tasks: parsedTasks,
      },
    });
  } catch (error) {
    console.error("Error generating learning path:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to generate learning path",
      details: error.message,
    });
  }
});

module.exports = router;
