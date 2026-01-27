// Import necessary modules
const Section = require("../models/Section")
const SubSection = require("../models/SubSection")
const { isVideoTypeSupported, uploadToCloudinary } = require("../utils/coudinaryFileHandle")


exports.createSubSection = async (req, res) => {
    try {
        const { sectionId, title, description } = req.body
        const video = req.files.video


        if (!sectionId || !title || !description || !video) {
            return res.status(404).json({
                success: false,
                message: "All Fields are Required"
            })
        }
        console.log(video);

        if (!isVideoTypeSupported()) {
            return res.status(415).json({
                success: false,
                message: "File type not supported. Allowed formats: 'mp4', 'mov' ."
            })
        }
        if (video.size > 104857699) {
            return res.status(413).json({
                success: false,
                message: "video size should be less then 100MB."
            })
        }
        const uploadedvideo = await uploadToCloudinary(video, process.env.VIDEO_FOLDER);

        console.log("uploadedvideo details:- ", uploadedvideo);
        const SubSectionDetails = await SubSection.create({
            title: title,
            timeDuration: `${uploadedvideo.duration}`,
            description: description,
            videoUrl: uploadedvideo.secure_url,
        })

        const updatedSection = await Section.findByIdAndUpdate(
            { _id: sectionId },
            { $push: { subSection: SubSectionDetails._id } },
            { new: true }
        ).populate("subSection")

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
        const { sectionId, subSectionId, title, description } = req.body;
        const subSection = await SubSection.findById(subSectionId);

        if (!subSection) {
            return res.status(404).json({
                success: false,
                message: "SubSection not found",
            })
        }

        if (title !== undefined) {
            subSection.title = title
        }

        if (description !== undefined) {
            subSection.description = description
        }
        if (req.files && req.files.video !== undefined) {
            const video = req.files.video
            const uploadDetails = await uploadToCloudinary(
                video,
                process.env.VIDEO_FOLDER
            )
            subSection.videoUrl = uploadDetails.secure_url;
            subSection.timeDuration = `${uploadDetails.duration}`;
        }

        await subSection.save()

        const updatedSection = await Section.findById(sectionId).populate(
            "subSection"
        )

        console.log("updated section", updatedSection)

        return res.json({
            success: true,
            message: "Section updated successfully",
            data: updatedSection,
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
        const { subSectionId, sectionId } = req.body
        await Section.findByIdAndUpdate(
            { _id: sectionId },
            {
                $pull: {
                    subSection: subSectionId,
                },
            }
        )
        const subSection = await SubSection.findByIdAndDelete({ _id: subSectionId })

        if (!subSection) {
            return res.status(404).json({
                success: false,
                message: "SubSection not found"
            })
        }

        const updatedSection = await Section.findById(sectionId).populate(
            "subSection"
        )

        return res.json({
            success: true,
            message: "SubSection deleted successfully",
            data: updatedSection,
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({
            success: false,
            message: "Error while deleting the SubSection",
            error: error.message
        })
    }
}