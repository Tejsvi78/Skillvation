const cloudinary = require("cloudinary").v2;
const fs = require("fs");

const imageFileType = ["jpg", "jpeg", "png"];
const videoFileType = ["mp4", "mov"];

function isImageTypeSupported(file) {
    const filetype = file.name.split('.').pop().toLowerCase();
    return imageFileType.includes(filetype);
}
function isVideoTypeSupported(file) {
    const filetype = file.name.split('.').pop().toLowerCase();
    return videoFileType.includes(filetype);
}


async function uploadToCloudinary(file, folder, quality) {
    console.log("file details:- ", file)
    const options = {
        folder,
        resource_type: "auto",
        fetch_format: "auto"
    };
    if (quality) {
        options.quality = quality;
    }
    console.log("tempFilePath", file.tempFilePath);
    console.log("Cloudinary cloud name:", cloudinary.config().cloud_name);

    const uploadedFile = await cloudinary.uploader.upload(file.tempFilePath, options);

    await fs.promises.unlink(file.tempFilePath);
    return uploadedFile;

}

module.exports = { isImageTypeSupported, isVideoTypeSupported, uploadToCloudinary, };




