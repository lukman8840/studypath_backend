var express = require("express");
var router = express.Router();
const userController = require("../controllers/userController");
const { DoctorMiddleware } = require("../middlewares/doctorsMiddleware");

/* GET users listing. */
router.get("/", function (req, res, next) {
  res.send("respond with a resource");
});

router.get("/patients", DoctorMiddleware, userController.GetPatients);
router.get("/records", userController.GetRecords);
router.get("/records/stats/:id", userController.GetRecordsStats);
router.get("/records/:id", userController.GetRecordsById);
router.delete("/records/:id", userController.DeleteRecord);
router.post("/logging-symptoms", userController.LogginSymptoms);
router.patch("/records/:recordId/status", userController.UpdateOverallStatus);
router.put("/records/:recordId/doctor-approval", DoctorMiddleware, userController.UpdateDoctorApproval);

module.exports = router;
