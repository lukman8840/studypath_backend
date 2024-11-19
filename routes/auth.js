const router = require("express").Router();
const authController = require("../controllers/authController");

router.post("/login", authController.Login_post);
router.post("/register", authController.Signup_post);

module.exports = router;
