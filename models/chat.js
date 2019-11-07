var express = require("express");
var mongoose = require("mongoose");

var chatSchema = new mongoose.Schema({
    nick: String,
    msg:  String,
    created: {type: Date, default: Date.now}
});

var Chat = new mongoose.model("Chat", chatSchema);

module.exports = Chat;