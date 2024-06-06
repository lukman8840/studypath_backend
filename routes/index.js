var express = require('express');
var router = express.Router();

const axios = require('axios');
/* GET home page. */

const { GoogleGenerativeAI } = require('@google/generative-ai');
// Access your API key as an environment variable (see "Set up your API key" above)
const genAI = new GoogleGenerativeAI(process.env.API);

// The Gemini 1.5 models are versatile and work with both text-only and multimodal prompts
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// The Gemini 1.5 models are versatile and work with both text-only and multimodal prompts
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Express' });
});

router.post('/learn', async function (req, res, next) {
  const { topic, level } = req.body;

  try {
    const prompt = `
           your are helpful assistant that help teach ${level} level the below topic,
            Your task is to generate break down of this topic "${topic}" into  learning tasks, 
            the learning task must not be less than five,  
            your response must be only json format, don't include anything before or after the json, 
            here is the format:
            {
              id:'first id',
              title: 'The First learning task',
              link: 'link to the source of the above',
            },
            {
              id:'second id',
              title: 'The Second learning task',
              link: 'link to the source of the above',
            },
            {
              id:'thrid id',
               title:'The third learning task',
              link: 'link to the source of the above',
            },

    `;
    const result = await model.generateContent(prompt);
    const responseGemini = await result.response;
    const text = responseGemini.text();

    res.status(200).json({ text });

    // const response = await axios.post(
    //   'https://api.openai.com/v1/chat/completions',
    //   {
    //     model: 'gpt-3.5-turbo-16k',
    //     messages: [
    //       {
    //         role: 'system',
    //         content: `
    //         your are helpful assistant that help teach ${level} level the below topic,
    //         Your task is to generate break down of this topic "${topic}" into  learning tasks,
    //         the learning task must not be less than five,
    //         your response must be only json format, don't include anything before or after the json,
    //         here is the format:
    //         {
    //           title: 'The First learning task',
    //           link: 'link to the source of the above',
    //         },
    //         {
    //           title: 'The Second learning task',
    //           link: 'link to the source of the above',
    //         },
    //         {
    //            title:'The third learning task',
    //           link: 'link to the source of the above',
    //         },

    //         `,
    //       },
    //     ],
    //     max_tokens: 2000,
    //     n: 1,
    //     stop: ['\n'],
    //   },
    //   {
    //     headers: {
    //       Authorization: `Bearer ${apiKey}`,
    //     },
    //   }
    // );

    // const tasks = response.data.choices[0].message.content
    //   .split('\n')
    //   .filter((task) => task);

    // res.status(200).json({ tasks });
  } catch (error) {
    // console.log(error.response.data.error.message);
    console.log('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
