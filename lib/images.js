// Exported methods adds image accessors and loadImagesFrom method to
// constructor.

var File = require("fs");
var Path = require("path");


// Supported images.
var IMAGES = [ "background", "footer", "icon", "logo", "strip", "thumbnail" ];


function applyImageMethods(constructor) {
  var prototype = constructor.prototype;

  // Accessor methods for images (logo, strip, etc).
  //
  // Call with an argument to set the image and return self, call with no
  // argument to get image value.
  //
  //   pass.icon(function(callback) { ... };
  //   console.log(pass.icon());
  //
  // The 2x and 3x suffix is used for high resolution version (file name uses
  // @2x or @3x suffix).
  //
  //   pass.icon2x("icon@2x.png");
  //   console.log(pass.icon2x());
  //
  //   pass.icon3x("icon@3x.png");
  //   console.log(pass.icon3x());
  IMAGES.forEach(function(key) {
    prototype[key] = function(value) {
      if (arguments.length === 0) {
        return this.images[key];
      } else {
        this.images[key] = value;
        return this;
      }
    };

    var retina2x = key + "2x";
    prototype[retina2x] = function(value) {
      if (arguments.length === 0) {
        return this.images[retina2x];
      } else {
        this.images[retina2x] = value;
        return this;
      }
    };

    var retina3x = key + "3x";
    prototype[retina3x] = function(value) {
      if (arguments.length === 0) {
        return this.images[retina3x];
      } else {
        this.images[retina3x] = value;
        return this;
      }
    };
  });


  // Load all images from the specified directory. Only supported images are
  // loaded, nothing bad happens if directory contains other files.
  //
  // path - Directory containing images to load
  prototype.loadImagesFrom = function(path) {
    var self = this;
    var files = File.readdirSync(path);
    files.forEach(function(filename) {
      var basename = Path.basename(filename, ".png");
      if (/@3x$/.test(basename) && ~IMAGES.indexOf(basename.slice(0, -3))) {
        // High resolution 3x
        self.images[basename.replace(/@3x$/, "3x")] = Path.resolve(path, filename);
      } else if (/@2x$/.test(basename) && ~IMAGES.indexOf(basename.slice(0, -3))) {
        // High resolution 2x
        self.images[basename.replace(/@2x$/, "2x")] = Path.resolve(path, filename);
      } else if (~IMAGES.indexOf(basename)) {
        // Normal resolution
        self.images[basename] = Path.resolve(path, filename);
      }
    });
    return this;
  };
}

module.exports = applyImageMethods;
