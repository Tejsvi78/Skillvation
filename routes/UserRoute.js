const express = require("express");

const { verifySignupOTP, signupUser, loginUser } = require("../controllers/auth");


const router = express.Router();

router.post("/signupUser", signupUser);
router.post("/verifySignupOTP", verifySignupOTP);
router.post("/loginUser", loginUser);

// router.get("/patient", authentication, isPatient, (req, res) => {
//     res.status(201).json({
//         success: true,
//         message: "This is a Protected Route for Patient."
//     })
// })

// router.get("/doctor", authentication, isDoctor, (req, res) => {
//     res.status(201).json({
//         success: true,
//         message: "This is a Protected Route for Doctor."
//     })
// })

module.exports = router;

