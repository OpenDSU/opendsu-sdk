if (typeof window !== "undefined" && typeof window.process === "undefined") {
	window.process = {};
}

if (typeof File === "undefined") {
	global.File = function (){}
}

require("./bindableModel_intermediar");
