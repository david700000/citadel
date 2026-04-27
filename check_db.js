const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });

const SiteDataSchema = new mongoose.Schema({
    hero: Array,
    events: Array,
    sermons: Array,
    gallery: Array,
    global: Object
}, { strict: false });
const SiteData = mongoose.model('SiteData', SiteDataSchema);

async function checkData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB");
        const data = await SiteData.findOne();
        if (data) {
            console.log("DATA_FOUND");
            console.log(JSON.stringify(data, null, 2));
        } else {
            console.log("DATA_NOT_FOUND");
        }
        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}
checkData();
