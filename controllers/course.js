const Category = require("../models/Category");
const Course = require("../models/Course");
const User = require("../models/User");
const { isImageTypeSupported, uploadToCloudinary, deleteFromCloudinary } = require("../utils/coudinaryFileHandle");

exports.createCourse = async (req, res) => {
    try {
        const { courseName, description, whatYouLearn, price, status, category, instructions: _instructions, tag: _tag, completionStatus } = req.body;
        const thumbnail = req.files.thumbnail;
        const instructor = req.payloadInfo.id;

        let tag = [];
        let instructions = [];

        try {
            tag = JSON.parse(_tag);
            instructions = JSON.parse(_instructions);
        } catch {
            return res.status(400).json({
                success: false,
                message: "Invalid tag or instructions format",
            });
        }

        if (!courseName || !description || !whatYouLearn || !tag.length || !price || !status || !thumbnail || !category || !instructions.length || !completionStatus) {
            return res.status(400).json({
                success: false,
                message: "All Fields are Mandatory",
            })
        }
        const instructorDetails = await User.findOne({
            _id: instructor,
            accountType: "instructor",
        });

        if (!instructorDetails) {
            return res.status(404).json({
                success: false,
                message: "Instructor Details Not Found",
            })
        }
        if (status !== "Draft" && status !== "Published") {
            return res.status(400).json({
                success: false,
                message: "Invalid Status format. ",
            })
        }
        if (completionStatus !== "Active" && completionStatus !== "Completed") {
            return res.status(400).json({
                success: false,
                message: "Invalid completionStatus state. ",
            })
        }
        const categoryExists = await Category.findById(category);
        if (!categoryExists) {
            return res.status(404).json({
                success: false,
                message: "Category not found while creating new Course"
            });
        }
        if (!isImageTypeSupported(thumbnail)) {
            return res.status(415).json({
                success: false,
                message: "File type not supported. Allowed formats: 'JPG', 'JPEG', 'PNG' ."
            })
        }
        if (price <= 0) {
            return res.status(400).json({
                success: false,
                message: "Price must be greater than 0",
            });
        }

        if (thumbnail.size > 10485759) {
            return res.status(413).json({
                success: false,
                message: "Thumbnail size should be less then 10MB."
            })
        }

        console.log("uploadedThumbnail details:- ", uploadedThumbnail);

        const newCourse = await Course.create({
            courseName, description, whatYouLearn, price, tag, instructor, category, instructions, status, completionStatus,

        });

        const uploadedThumbnail = await uploadToCloudinary(thumbnail, `Courses/${newCourse._id}/thumbnail`, "auto");
        newCourse.thumbnail = {
            url: uploadedThumbnail.secure_url,
            public_id: uploadedThumbnail.public_id
        }
        await newCourse.save();
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

exports.editCourseDetails = async (req, res) => {
    try {
        const instructorId = req.payloadInfo.id;
        const { courseId, courseName, description, whatYouLearn, price, status, instructions: _instructions, tag: _tag, completionStatus, } = req.body;

        if (!courseId) {
            return res.status(400).json({
                success: false,
                message: "courseId is required to edit course",
            });
        }

        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({
                success: false,
                message: "Course not found",
            });
        }

        if (course.instructor.toString() !== instructorId) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to edit this course",
            });
        }


        const instructor = await User.findOne({
            _id: instructorId,
            accountType: "instructor",
        });
        if (!instructor) {
            return res.status(403).json({
                success: false,
                message: "Instructor not found",
            });
        }


        const updates = {};

        if (courseName) updates.courseName = courseName;
        if (description) updates.description = description;

        if (whatYouLearn) updates.whatYouLearn = whatYouLearn;

        if (price !== undefined) {
            if (price <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Price must be greater than 0",
                });
            }
            updates.price = price;
        }

        if (status) {
            if (!["Draft", "Published"].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid status value",
                });
            }
            updates.status = status;
        }

        if (completionStatus) {
            if (!["Active", "Completed"].includes(completionStatus)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid completionStatus value",
                });
            }
            updates.completionStatus = completionStatus;
        }


        if (_tag) {
            let tag;
            try {
                tag = JSON.parse(_tag);
            } catch {
                return res.status(400).json({
                    success: false,
                    message: "Invalid tag format",
                });
            }
            if (!Array.isArray(tag) || tag.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Tag must be a non-empty array",
                });
            }
            updates.tag = tag;
        }

        if (_instructions) {
            let instructions;
            try {
                instructions = JSON.parse(_instructions);
            } catch {
                return res.status(400).json({
                    success: false,
                    message: "Invalid instructions format",
                });
            }
            if (!Array.isArray(instructions) || instructions.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Instructions must be a non-empty array",
                });
            }
            updates.instructions = instructions;
        }

        // Thumbnail update (optional)
        let uploadedThumbnail;
        if (req.files?.thumbnail) {
            const thumbnail = req.files.thumbnail;

            if (!isImageTypeSupported(thumbnail)) {
                return res.status(415).json({
                    success: false,
                    message: "Only JPG, JPEG, PNG files are allowed",
                });
            }

            if (thumbnail.size >= 10 * 1024 * 1024) {
                return res.status(413).json({
                    success: false,
                    message: "Thumbnail must be less than 10MB",
                });
            }

            uploadedThumbnail = await uploadToCloudinary(thumbnail, process.env.THUMBNAIL_FOLDER, "auto");

            updates.thumbnail = {
                url: uploadedThumbnail.secure_url,
                public_id: uploadedThumbnail.public_id,
            };
        }

        const updatedCourse = await Course.findByIdAndUpdate(
            courseId,
            updates,
            { new: true, runValidators: true }
        );

        // Delete old thumbnail AFTER successful DB update
        if (uploadedThumbnail && course.thumbnail?.public_id) {
            await deleteFromCloudinary(course.thumbnail.public_id);
        }

        return res.status(200).json({
            success: true,
            message: "Course updated successfully",
            data: updatedCourse,
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error while updating course",
            error: error.message,
        });
    }
}