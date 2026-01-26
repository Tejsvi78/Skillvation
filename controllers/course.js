const Category = require("../models/Category");
const Course = require("../models/Course");
const User = require("../models/User");
const { isImageTypeSupported, uploadToCloudinary } = require("../utils/fileUploadToCloudinary");

exports.createCourse = async (req, res) => {
    try {
        const { courseName, description, whatYouLearn, price, category, status, instructions: _instructions, tag: _tag } = req.body;
        const thumbnail = req.files.thumbnail;
        const instructor = req.payloadInfo._id;

        const tag = JSON.parse(_tag);
        const instructions = JSON.parse(_instructions);

        if (!courseName || !description || !whatYouLearn || !price || !tag.length || !thumbnail || !category || !instructions.length) {
            return res.status(400).json({
                success: false,
                message: "All Fields are Mandatory",
            })
        }
        if (!isImageTypeSupported()) {
            return res.status(415).json({
                success: false,
                message: "File type not supported. Allowed formats: 'JPG', 'JPEG', 'PNG' ."
            })
        }
        if (thumbnail.size > 10485759) {
            return res.status(413).json({
                success: false,
                message: "Thumbnail size should be less then 10MB."
            })
        }
        const uploadedThumbnail = await uploadToCloudinary(thumbnail, process.env.THUMBNAIL_FOLDER, "auto");

        if (!status || status === undefined) {
            status = "Draft"
        }
        console.log("uploadedThumbnail details:- ", uploadedThumbnail);

        const newCourse = Course.create({
            courseName, description, whatYouLearn, price, tag, instructor, category, instructions, status, thumbnail: uploadedThumbnail.secure_url,
        })

        await Category.findByIdAndUpdate(
            { _id: category },
            {
                $push: {
                    courses: newCourse._id,
                }
            },
            { new: true }
        );
        await User.findByIdAndUpdate(
            { _id: instructor },
            {
                $push: {
                    courses: newCourse._id,
                }
            },
            { new: true }
        )
        res.status(200).json({
            success: true,
            data: newCourse,
            message: "Course Created Successfully",
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Error while Creating the Course",
            error: error.message,
        })
    }
}