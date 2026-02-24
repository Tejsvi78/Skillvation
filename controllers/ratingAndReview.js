const Course = require("../models/Course");
const RatingAndReviews = require("../models/RatingAndReviews");

exports.createRating = async (req, res) => {
    try {
        const userId = req.payloadInfo.id;
        const { courseId } = req.body;
        let { rating } = req.body;
        const review = req.body.review?.trim();

        rating = Number(rating);
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: "Rating must be between 1 and 5",
            });
        }

        const course = await Course.findOne({
            _id: courseId,
            enrolledStudents: userId,
        });

        if (!course) {
            return res.status(404).json({
                success: false,
                message: "You are not enrolled in this course",
            });
        }

        const alreadyReviewed = await RatingAndReviews.findOne({
            user: userId,
            course: courseId,
        });

        if (alreadyReviewed) {
            return res.status(400).json({
                success: false,
                message: "You already reviewed this course",
            });
        }

        const ratingReview = await RatingAndReviews.create({
            rating,
            review,
            course: courseId,
            user: userId,
        });

        const newTotalRatings = course.totalRatings + 1;
        const newAvgRating = (course.avgRating * course.totalRatings + rating) / newTotalRatings;

        await Course.findByIdAndUpdate(courseId, {
            $push: { ratingAndReviews: ratingReview._id },
            $set: {
                avgRating: newAvgRating,
                totalRatings: newTotalRatings,
            },
        });

        return res.status(200).json({
            success: true,
            message: "Rating added successfully",
            ratingReview,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to create rating",
            error: error.message,
        });
    }
};


exports.updateRating = async (req, res) => {
    try {
        const userId = req.payloadInfo.id;
        const { rating, review, courseId } = req.body;
        const newRating = Number(rating);

        const ratingDoc = await RatingAndReviews.findOne({
            user: userId,
            course: courseId,
        });
        if (!ratingDoc) {
            return res.status(404).json({
                success: false,
                message: "Review not found",
            });
        }

        const oldRating = ratingDoc.rating;

        await RatingAndReviews.findByIdAndUpdate(
            ratingDoc._id,
            {
                rating: newRating,
                review: review?.trim(),
            }
        );

        const course = await Course.findById(
            courseId,
            { avgRating: 1, totalRatings: 1 }
        );

        const newAvg = ((course.avgRating * course.totalRatings) - oldRating + newRating) / course.totalRatings;

        await Course.findByIdAndUpdate(courseId, {
            $set: { avgRating: newAvg }
        });

        return res.json({
            success: true,
            message: "Rating updated successfully",
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error while updating Rating",
            error: error.message,
        });
    }
};

exports.getAllRating = async (req, res) => {
    try {
        const allReviews = await RatingAndReviews.find({})
            .sort({ rating: "desc" })
            .populate({
                path: "user",
                select: "userName email image",
            })
            .populate({
                path: "course",
                select: "courseName",
            })
            .exec();
        return res.status(200).json({
            success: true,
            message: "All reviews fetched successfully",
            data: allReviews,
        });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Error while getting all Ratings",
            error: error.message,
        })
    }
}

exports.deleteRating = async (req, res) => {
    try {
        const userId = req.payloadInfo.id;
        const { courseId } = req.body;

        const ratingDoc = await RatingAndReviews.findOne({
            user: userId,
            course: courseId,
        });

        if (!ratingDoc) {
            return res.status(404).json({
                success: false,
                message: "Rating not found",
            });
        }

        const deletedRating = ratingDoc.rating;

        await RatingAndReviews.findByIdAndDelete(ratingDoc._id);

        const course = await Course.findById(
            courseId,
            { avgRating: 1, totalRatings: 1 }
        );

        const newTotal = course.totalRatings - 1;

        let newAvg = 0;

        if (newTotal > 0) {
            newAvg = ((course.avgRating * course.totalRatings) - deletedRating) / newTotal;
        }

        await Course.findByIdAndUpdate(courseId, {
            $pull: { ratingAndReviews: ratingDoc._id },
            $set: {
                avgRating: newAvg,
                totalRatings: newTotal,
            },
        });

        return res.json({
            success: true,
            message: "Rating deleted successfully",
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Delete failed",
            error: error.message,
        });
    }
};