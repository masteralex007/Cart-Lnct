var mongoose = require("mongoose");

//making products database schema

var productSchema = new mongoose.Schema({
    name: String,
    description: String,
    price: Number,
    email: String,
    image: String,
    author: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref:  "User"
        },
        username: String
    },
    comments: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref:  "Comment"
        } 
    ]
});

//creating model of above Schema

var Product = mongoose.model("Product", productSchema);

module.exports = Product;