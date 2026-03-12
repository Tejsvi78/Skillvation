const Section = require("../models/Section");
const Course = require("../models/Course");
const SubSection = require("../models/SubSection");

exports.createSection = async (req, res) => {
    try {
        const { sectionName, courseId } = req.body;

        if (!sectionName || !courseId) {
            return res.status(400).json({
                success: false,
                message: "Missing required properties",
            });
        }

        const newSection = await Section.create({ sectionName });

        const updatedCourse = await Course.findByIdAndUpdate(
            courseId,
            {
                $push: {
                    content: newSection._id,
                },
            },
            { new: true }
        )
            .populate({
                path: "content",
                populate: {
                    path: "subSection",
                },
            })
            .exec();

        res.status(200).json({
            success: true,
            message: "Section created successfully",
            updatedCourse,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error while creating new Section",
            error: error.message,
        });
    }
};

exports.updateSection = async (req, res) => {
    try {
        const { sectionName, sectionId, courseId } = req.body;
        if (!sectionName || !courseId) {
            return res.status(400).json({
                success: false,
                message: "Missing required properties",
            });
        }
        const section = await Section.findByIdAndUpdate(
            sectionId,
            { sectionName },
            { new: true }
        );

        const course = await Course.findById(courseId)
            .populate({
                path: "content",
                populate: {
                    path: "subSection",
                },
            })
            .exec();

        res.status(200).json({
            success: true,
            message: "Section Updated successfully",

        });
    } catch (error) {
        console.error("Error updating section:", error);
        res.status(500).json({
            success: false,
            message: "Error while updating Section",
            error: error.message,
        });
    }
};

exports.deleteSection = async (req, res) => {
    try {
        const { sectionId, courseId } = req.body;
        const section = await Section.findById(sectionId);

        if (!section) {
            return res.status(404).json({
                success: false,
                message: "Section not found",
            });
        }

        const totalDuration = section.totalDuration || 0;

        const subSections = await SubSection.find({
            _id: { $in: section.subSection }
        });
        const totalVideos = subSections.length;

        await Promise.all(
            subSections.map(sub =>
                sub.public_id
                    ? deleteFromCloudinary(sub.public_id, "video")
                    : Promise.resolve()
            )
        );

        await SubSection.deleteMany({
            _id: { $in: section.subSection }
        });

        await Course.findByIdAndUpdate(courseId, {
            $pull: { content: sectionId },
            $inc: {
                totalVideos: -totalVideos,
                totalDuration: -totalDuration,
            }
        });

        await Section.findByIdAndDelete(sectionId);

        const updatedCourse = await Course.findById(courseId)
            .populate({
                path: "content",
                populate: { path: "subSection" }
            });

        return res.status(200).json({
            success: true,
            message: "Section deleted successfully",
            data: updatedCourse,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error while deleting section",
            error: error.message,
        });
    }
};