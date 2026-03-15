const Payment = require("models/Payment");
const { razorpay } = require("../config/connectRazorpay");
const Course = require("../models/Course");
const User = require("../models/User");
const crypto = require("crypto");
require("dotenv").config();

exports.submitBankDetails = async (req, res) => {
  try {
    const { accountHolderName, accountNumber, ifsc } = req.body;
    if (!accountHolderName || !accountNumber || !ifsc) {
      return res.status(400).json({
        success: false,
        message: "All Fields are Mandatory",
      });
    }
    const instructor = await User.findById(req.payloadInfo.id);

    if (!instructor)
      return res.status(404).json({
        success: false,
        message: "Instructor not found",
      });
    if (instructor.razorpay?.fundAccountId) {
      return res.status(400).json({
        success: false,
        message: "Already submitted",
      });
    }

    const contact = await razorpay.contacts.create({
      name: accountHolderName,
      type: "employee",
      reference_id: instructor._id.toString(),
    });
    const fundAccount = await razorpay.fundAccount.create({
      contact_id: contact.id,
      account_type: "bank_account",
      bank_account: {
        name: accountHolderName,
        account_number: accountNumber,
        ifsc,
      },
    });

    instructor.razorpay = {
      contactId: contact.id,
      fundAccountId: fundAccount.id,
    };
    await instructor.save();

    res.status(200).json({
      success: true,
      message: "Bank details saved",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to creat fundAccount",
      error: error.message,
    });
  }
};

exports.buyCourse = async (req, res) => {
  try {
    const studentId = req.payloadInfo.id;
    const { courseId } = req.body;

    const course = await Course.findById(courseId).populate("instructor");
    if (!course || course.status !== "Published") {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }
    if (course.enrolledStudents.includes(studentId)) {
      return res.status(400).json({
        success: false,
        message: "You are already enrolled in this course",
      });
    }

    const platformFee = Math.round(course.price * 0.2);
    const instructorEarning = course.price - platformFee;

    const order = await razorpay.orders.create({
      amount: course.price * 100,
      currency: "INR",
      receipt: `rcpt_${courseId}_${studentId}_${Date.now()}`,
      payment_capture: 1,
    });

    const payment = await Payment.create({
      student: studentId,
      course: courseId,
      amount: course.price,
      platformFee,
      instructorEarning,
      razorpayOrderId: order.id,
      status: "Pending",
    });

    res.status(200).json({
      success: true,
      message: "Order created",
      data: { orderId: order.id, amount: course.price, currency: "INR" },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Payment creation failed",
      error: error.message,
    });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const userId = req.payloadInfo.id;
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      courseId,
    } = req.body;

    if (
      !razorpay_payment_id ||
      !razorpay_order_id ||
      !razorpay_signature ||
      !courseId
    ) {
      return res.status(400).json({
        success: false,
        message: "All Fields are Mandatory to verify Paymemt",
      });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }
    const payment = await Payment.findOne({
      razorpayOrderId: razorpay_order_id,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found",
      });
    }

    if (payment.status === "Success") {
      return res.status(400).json({
        success: false,
        message: "Payment already verified",
      });
    }

    await processEnrollment(userId, courseId, razorpay_payment_id);

    payment.status = "Success";
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    await payment.save();

    res.status(200).json({
      success: true,
      message: "Payment verified and course enrolled",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Payment verification failed",
      error: error.message,
    });
  }
};

exports.razorpayWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (signature !== expectedSignature) {
      return res.status(400).json({ success: false });
    }

    const event = req.body.event;

    if (event === "payment.captured") {
      const paymentEntity = req.body.payload.payment.entity;
      const payment = await Payment.findOne({
        razorpayOrderId: paymentEntity.order_id,
      });

      if (!payment) {
        console.log("Webhook: Payment record not found");
        return res.status(200).send();
      }
      if (payment.status !== "Pending") {
        console.log("Webhook: Payment already processed");
        return res.status(200).send();
      }

      await processEnrollment(
        payment.student,
        payment.course,
        paymentEntity.id,
      );

      payment.status = "Success";
      payment.razorpayPaymentId = paymentEntity.id;

      await payment.save();

      return res.status(200).send();
    }

    if (event === "payment.failed") {
      const paymentEntity = req.body.payload.payment.entity;

      const payment = await Payment.findOne({
        razorpayOrderId: paymentEntity.order_id,
      });

      if (!payment) {
        return res.status(200).send();
      }
      if (payment.status !== "Pending") {
        return res.status(200).send();
      }

      payment.status = "Failed";
      payment.razorpayPaymentId = paymentEntity.id;

      await payment.save();

      return res.status(200).send();
    }

    return res.status(200).send();
  } catch (error) {
    console.error("Webhook Error:", error);
    return res.status(500).json({
      success: false,
      message: "Webhook processing failed",
    });
  }
};

exports.payAllInstructors = async (req, res) => {
  try {
    const instructors = await User.find({
      accountType: "instructor",
      pendingBalance: { $gt: 0 },
    });

    for (let instructor of instructors) {
      if (!instructor.razorpay?.fundAccountId) continue;

      const amount = instructor.pendingBalance * 100;
      if (amount <= 0) continue;

      const payout = await razorpay.payouts.create({
        account_number: process.env.RAZORPAY_ACCOUNT,
        fund_account_id: instructor.razorpay.fundAccountId,
        amount,
        currency: "INR",
        mode: "IMPS",
        purpose: "payout",
        queue_if_low_balance: true,
      });

      instructor.totalEarnings += instructor.pendingBalance;
      instructor.pendingBalance = 0;
      await instructor.save();
    }

    res.status(200).json({
      success: true,
      message: "All pending payouts processed",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to process payouts",
      error: error.message,
    });
  }
};

exports.payInstructor = async (req, res) => {
  try {
    const { instructorId } = req.body;
    const instructor = await User.findById(instructorId);
    if (!instructor || instructor.pendingBalance <= 0)
      return res.status(400).json({
        success: false,
        message: "No pending balance",
      });

    const amount = instructor.pendingBalance * 100;

    const payout = await razorpay.payouts.create({
      account_number: process.env.RAZORPAY_ACCOUNT,
      fund_account_id: instructor.razorpay.fundAccountId,
      amount,
      currency: "INR",
      mode: "IMPS",
      purpose: "payout",
      queue_if_low_balance: true,
    });

    instructor.totalEarnings += instructor.pendingBalance;
    instructor.pendingBalance = 0;
    await instructor.save();

    res.status(200).json({
      success: true,
      message: "Instructor paid successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to pay instructor",
      error: error.message,
    });
  }
};

exports.updateBankDetails = async (req, res) => {
  try {
    const { accountHolderName, accountNumber, ifsc } = req.body;
    if (!accountHolderName || !accountNumber || !ifsc) {
      return res.status(400).json({
        success: false,
        message: "All bank details are required",
      });
    }
    const instructor = await User.findById(req.payloadInfo.id);

    if (!instructor || instructor.accountType !== "instructor") {
      return res.status(403).json({
        success: false,
        message: "Only instructors can update bank details",
      });
    }

    if (instructor.razorpay?.fundAccountId) {
      await razorpay.fundAccount
        .remove(instructor.razorpay.fundAccountId)
        .catch(() => {});
    }

    // Create new contact/fund account on Razorpay
    const contact = await razorpay.contacts.create({
      name: accountHolderName,
      type: "employee",
      reference_id: instructor._id.toString(),
    });

    const fundAccount = await razorpay.fundAccount.create({
      contact_id: contact.id,
      account_type: "bank_account",
      bank_account: {
        name: accountHolderName,
        account_number: accountNumber,
        ifsc,
      },
    });

    instructor.razorpay = {
      contactId: contact.id,
      fundAccountId: fundAccount.id,
    };
    await instructor.save();

    res
      .status(200)
      .json({ success: true, message: "Bank details updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to update bank details",
      error: error.message,
    });
  }
};

async function processEnrollment(studentId, courseId, paymentId) {
  const course = await Course.findById(courseId);

  if (!course) return;

  if (course.studentsEnroled.includes(studentId)) return;

  course.enrolledStudents.push(studentId);
  course.totalStudents = (course.totalStudents || 0) + 1;

  const instructorShare = course.price * 0.8;
  course.totalEarning = (course.totalEarning || 0) + instructorShare;

  await course.save();

  const instructor = await User.findById(course.instructor);

  instructor.pendingBalance =
    (instructor.pendingBalance || 0) + instructorShare;

  await instructor.save();

  const student = await User.findById(studentId);

  student.courses = student.courses || [];
  student.courses.push(courseId);

  await student.save();
}
