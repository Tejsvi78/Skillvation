const Category = require("../models/Category");
const Course = require("../models/Course");
const CourseProgress = require("../models/CourseProgress");
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


exports.getAllCourses = async (req, res) => {
    try {

        const { page = 1, limit = 10, searchTag, category, sortBy } = req.query;
        const query = { status: "Published" };

        if (searchTag) query.tag = { $in: [searchTag] };
        if (category) query.category = category;

        let coursesQuery = Course.find(query)
            .select("courseName instructor price avgRating category completionStatus thumbnail")
            .populate("instructor", "userName")
            .populate("category", "name");

        if (sortBy === "popular") coursesQuery = coursesQuery.sort({ totalStudents: -1 });
        if (sortBy === "priceAsc") coursesQuery = coursesQuery.sort({ price: 1 });
        if (sortBy === "priceDesc") coursesQuery = coursesQuery.sort({ price: -1 });

        const total = await Course.countDocuments(query);
        const courses = await coursesQuery
            .skip((page - 1) * limit)
            .limit(Number(limit));

        const formattedCourses = courses.map(course => ({
            id: course._id,
            courseName: course.courseName,
            thumbnail: course.thumbnail.url,
            price: course.price,
            rating: course.avgRating || 0,
            instructor: course.instructor?.userName || "Unknown",
            category: course.category?.name || "Uncategorized",
            completionStatus: course.completionStatus || "Active"
        }));

        res.status(200).json({
            success: true,
            message: "Courses fetched successfully",
            total,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(total / limit),
            data: formattedCourses
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Error fetching courses",
            error: error.message
        });
    }
};



exports.getHomeCourses = async (req, res) => {
    try {
        const mapCourses = (courses) => courses.map(course => ({
            id: course._id,
            courseName: course.courseName,
            thumbnail: course.thumbnail.url,
            price: course.price,
            rating: course.avgRating || 0,
            instructor: course.instructor?.userName || "Unknown",
            category: course.category?.name || "Uncategorized",
            completionStatus: course.completionStatus || "Active",
        }));

        const mixedCourses = await Course.find({ status: "Published" })
            .select("courseName instructor price avgRating category completionStatus thumbnail")
            .populate("instructor", "userName")
            .populate("category", "name")
            .sort({ createdAt: -1 })
            .limit(12);

        const topSellingCourses = await Course.find({ status: "Published" })
            .select("courseName instructor price avgRating category completionStatus thumbnail")
            .populate("instructor", "userName")
            .populate("category", "name")
            .sort({ totalStudents: -1 })
            .limit(10);

        res.status(200).json({
            success: true,
            data: {
                mixedCourses: mapCourses(mixedCourses),
                topSellingCourses: mapCourses(topSellingCourses),
            },
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error loading home page courses",
            error: error.message,
        });
    }
};

exports.getACourseDetails = async (req, res) => {
    try {
        const { courseId } = req.body;

        const course = await Course.findById(courseId)
            .select("courseName description whatYouLearn content instructor price avgRating category instructions totalDuration completionStatus thumbnail updatedAt")
            .populate("content", "sectionName")
            .populate("instructor", "userName")
            .populate("category", "name");

        if (!course) {
            return res.status(404).json({
                success: false,
                message: "Course not found",
            });
        }

        const formattedCourse = {
            id: course._id,
            courseName: course.courseName,
            description: course.description,
            whatYouLearn: course.whatYouLearn,
            content: course.content,
            instructions: course.instructions,
            totalDuration: course.totalDuration,
            updatedAt: course.updatedAt,
            thumbnail: course.thumbnail?.url || "",
            price: course.price,
            rating: course.avgRating || 0,
            instructor: course.instructor?.userName || "Unknown",
            category: course.category?.name || "Uncategorized",
            completionStatus: course.completionStatus || "Active"
        };

        res.status(200).json({
            success: true,
            message: "A course is fetched Successfully. ",
            data: formattedCourse,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error loading a course details",
            error: error.message,
        });
    }
};



exports.showEnrolledCourses = async (req, res) => {
    try {
        const userId = req.payloadInfo.id;

        const user = await User.findById(userId).populate({
            path: "courses",
            select: "courseName instructor avgRating category completionStatus thumbnail totalVideos",
            populate: [
                { path: "instructor", select: "userName" },
                { path: "category", select: "name" },
            ],
        });

        if (!user || !user.courses.length) {
            return res.status(200).json({
                success: true,
                message: "No enrolled courses",
                data: [],
            });
        }

        const progressDocs = await CourseProgress.find({
            userId,
            courseID: { $in: user.courses.map(c => c._id) },
        });

        const formattedCourses = user.courses.map(course => {
            const progressDoc = progressDocs.find(
                p => p.courseID.toString() === course._id.toString()
            );

            const completed = progressDoc?.completedVideos.length || 0;
            const progress = course.totalVideos
                ? Math.round((completed / course.totalVideos) * 100)
                : 0;

            return {
                id: course._id,
                courseName: course.courseName,
                thumbnail: course.thumbnail?.url || "",
                rating: course.avgRating || 0,
                instructor: course.instructor?.userName || "Unknown",
                category: course.category?.name || "Uncategorized",
                completionStatus: course.completionStatus || "Active",
                progress,
            };
        });

        res.status(200).json({
            success: true,
            message: "Courses fetched successfully",
            data: formattedCourses,
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching enrolled courses",
            error: error.message,
        });
    }
};


exports.openCourse = async (req, res) => {
    try {
        const { courseID } = req.body;

        const openedCourse = await Course.findById(courseID)
            .select("courseName description content instructor totalVideos")
            .populate({
                path: "content",
                select: "sectionName totalDuration subSection",
                populate: {
                    path: "subSection",
                    select: "title timeDuration description videoUrl updatedAt"
                }
            })
            .populate({
                path: "instructor",
                select: "userName"
            });

        if (!openedCourse) {
            return res.status(404).json({
                success: false,
                message: "Course not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Course opened successfully",
            data: openedCourse
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error while opening course",
            error: error.message
        });
    }
};


