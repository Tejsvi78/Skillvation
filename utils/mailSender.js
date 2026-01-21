const nodemailer = require("nodemailer");

const mailSender = async (email, subject, body) => {
    try {
        let transporter = nodemailer.createTransport({
            host: process.env.MAIL_HOST,
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASS,
            }
        })


        let mailInfo = await transporter.sendMail({
            from: 'Skillvation - Tejsvi Sharma',
            to: `${email}`,
            subject: `${subject}`,
            html: `${body}`,
        })
        console.log("Mail Info:- ", mailInfo);
        return info;
    }
    catch (error) {
        console.log("Error in mailSender Function", error.message);
    }
}

module.exports = mailSender;