var express = require("express");
var router = express.Router();
const userController = require("../controllers/userController");
const { DoctorMiddleware } = require("../middlewares/doctorsMiddleware");
const { AdminMiddleware } = require("../middlewares/adminMiddleware");

/* GET users listing. */
router.get("/", AdminMiddleware, userController.GetUsers);

router.get("/patients", DoctorMiddleware, userController.GetPatients);
router.get("/records", userController.GetRecords);
router.get("/records/stats/:id", userController.GetRecordsStats);
router.get("/records/:id", userController.GetRecordsById);
router.delete("/records/:id", userController.DeleteRecord);
router.post("/logging-symptoms", userController.LogginSymptoms);
router.patch("/records/:recordId/status", userController.UpdateOverallStatus);
router.put("/records/:recordId/doctor-approval", DoctorMiddleware, userController.UpdateDoctorApproval);

module.exports = router;
