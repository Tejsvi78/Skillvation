// Import necessary modules
const Course = require("../models/Course")
const Section = require("../models/Section")
const SubSection = require("../models/SubSection")
const { isVideoTypeSupported, uploadToCloudinary, deleteFromCloudinary } = require("../utils/coudinaryFileHandle")

const mongoose = require("mongoose");

exports.createSubSection = async (req, res) => {
    try {
        const { sectionId, title, description, courseId } = req.body
        const video = req.files?.video


        if (!sectionId || !title || !description || !video || !courseId) {
            return res.status(404).json({
                success: false,
                message: "All Fields are Required"
            })
        }
        console.log(video);

        if (!isVideoTypeSupported(video)) {
            return res.status(415).json({
                success: false,
                message: "File type not supported. Allowed formats: 'mp4', 'mov' ."
            })
        }
        if (video.size >= 100 * 1024 * 1024) {
            return res.status(413).json({
                success: false,
                message: "video size should be less then 100MB."
            })
        }
        const uploadedVideo = await uploadToCloudinary(video, `courses/${courseId}`, 100);
        console.log("uploadedvideo details:- ", uploadedVideo);

        const session = await mongoose.startSession();
        session.startTransaction();

        const [subSection] = await SubSection.create([{
            title,
            description,
            timeDuration: uploadedVideo.duration,
            videoUrl: uploadedVideo.secure_url,
            public_id: uploadedVideo.public_id,
        }], { session });

        const [updatedSection] = await Promise.all([
            Section.findByIdAndUpdate(
                sectionId,
                {
                    $push: { subSection: subSection._id },
                    $inc: { totalDuration: uploadedVideo.duration }
                },
                { new: true, session }
            ).populate({
                path: "subSection",
                select: "title timeDuration videoUrl"
            }),

            Course.findByIdAndUpdate(
                courseId,
                {
                    $inc: {
                        totalDuration: uploadedVideo.duration,
                        totalVideos: 1
                    }
                },
                { session }
            )
        ]);

        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
            success: true,
            message: "Sub-Section created successfully.",
            data: updatedSection
        })
    } catch (error) {
        console.error("Error while creating new sub-section:", error)
        return res.status(500).json({
            success: false,
            message: "Error while creating new sub-section.",
            error: error.message,
        })
    }
}

exports.updateSubSection = async (req, res) => {
    try {
        const { subSectionId, title, description } = req.body;

        if (!subSectionId || !title || !description) {
            return res.status(404).json({
                success: false,
                message: "All Fields are Required"
            })
        }

        const updatedSubSection = await SubSection.findByIdAndUpdate(
            subSectionId,
            { title, description },
            { new: true }
        );

        if (!updatedSubSection)
            return res.status(404).json({
                success: false,
                message: "SubSection not found"
            });

        return res.json({
            success: true,
            message: "Section updated successfully",

        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({
            success: false,
            message: "Error while updating the Sub-section",
            error: error.message
        })
    }
}

exports.deleteSubSection = async (req, res) => {
    try {
        const { subSectionId, sectionId, courseId } = req.body;

        const subSection = await SubSection.findById(subSectionId);

        if (!subSection) {
            return res.status(404).json({
                success: false,
                message: "SubSection not found"
            });
        }

        await deleteFromCloudinary(subSection.public_id, "video");

        await SubSection.findByIdAndDelete(subSectionId);

        await Promise.all([
            Section.findByIdAndUpdate(sectionId, {
                $pull: { subSection: subSectionId },
                $inc: { totalDuration: -subSection.timeDuration }
            }),

            Course.findByIdAndUpdate(courseId, {
                $inc: {
                    totalDuration: -subSection.timeDuration,
                    totalVideos: -1
                }
            })
        ]);

        res.json({
            success: true,
            message: "Sub-section Deleted successfully",
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "error while deleting subsection",
            error: error.message
        });
    }
};