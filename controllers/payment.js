const Payment = require("models/Payment");
const { razorpay } = require("../config/connectRazorpay");
const Course = require("../models/Course");
const User = require("../models/User");

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
    if (course.students.includes(studentId)) {
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

exports.razorpayWebhook = async (req, res) => {};

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
