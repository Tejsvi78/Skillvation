const Category = require("../models/Category");


exports.createCategory = async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name || !description) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }
        const CategorysDetails = await Category.create({
            name,
            description
        });
        console.log(CategorysDetails);
        return res.status(200).json({
            success: true,
            message: "Category Created Successfully",
        });
    } catch (error) {
        return res.status(500).json({
            success: true,
            message: "Error while creating Category. ",
            error: error.message
        });
    }
};

exports.showAllCategories = async (req, res) => {
    try {

        const allCategorys = await Category.find({});
        res.status(200).json({
            success: true,
            data: allCategorys,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: " Unable to find all Categories. ",
            error: error.message
        });
    }
};

exports.categoryPageDetails = async (req, res) => {
    try {
        const { categoryId } = req.body
        console.log("PRINTING CATEGORY ID: ", categoryId);

        const selectedCategory = await Category.findById(categoryId)
            .populate({
                path: "courses",
                match: { status: "Published" },
                populate: "ratingAndReviews",
            })
            .exec()

        if (!selectedCategory) {
            console.log("Category not found.")
            return res.status(404).json({
                success: false,
                message: "Category not found"
            })
        }

        if (selectedCategory.courses.length === 0) {
            console.log("No courses found for the selected category.")
            return res.status(404).json({
                success: false,
                message: "No courses found for the selected category.",
            })
        }

        // Get courses for other categories
        const differentCategory = await Category.findOne({
            _id: { $ne: categoryId },
        }).populate({
            path: "courses",
            match: { status: "Published" },
        });

        // Get top-selling courses across all categories
        const mostSellingCourses = await Course
            .find({ status: "Published" })
            .sort({ totalStudents: -1 })
            .limit(10)
            .lean();

        // console.log("mostSellingCourses COURSE", mostSellingCourses)
        res.status(200).json({
            success: true,
            data: {
                differentCategory,
                mostSellingCourses,
            },
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error while fetching Category page Details",
            error: error.message,
        })
    }
}
