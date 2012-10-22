// Exports function for creating a new template.

var Crypto    = require("crypto");
var execFile  = require("child_process").execFile;
var File      = require("fs");
var Path      = require("path");
var archiver  = require("archiver");
var async     = require("async");


// Template will have accessor methods for these fields.
var TEMPLATE            = [ "passTypeIdentifier", "teamIdentifier",
                            "backgroundColor", "foregroundColor", "labelColor", "logoText",
                            "organizationName", "suppressStripShine", "webServiceURL"];
// Supported passbook styles.
var STYLES              = [ "boardingPass", "coupon", "eventTicket", "generic", "storeCard" ];
// Top-level passbook fields.
var TOP_LEVEL           = [ "authenticationToken", "backgroundColor", "barcode", "description",
                            "foregroundColor", "labelColor", "locations", "logoText",
                            "organizationName", "relevantDate", "serialNumber", 
                            "suppressStripShine", "webServiceURL"];
// These top level fields are required for a valid passbook
var REQUIRED_TOP_LEVEL  = [ "description", "organizationName", "passTypeIdentifier",
                            "serialNumber", "teamIdentifier" ];
// Passbook structure keys.
var STRUCTURE           = [ "auxiliaryFields", "backFields", "headerFields",
                            "primaryFields", "secondaryFields", "transitType" ];
// Supported images.
var IMAGES              = [ "background", "footer", "icon", "logo", "strip", "thumbnail" ];
// These images are required for a valid passbook.
var REQUIRED_IMAGES     = [ "icon", "logo" ];


// Create a new template.
//
// style  - Passbook style (coupon, eventTicket, etc)
// fields - Passbook fields (passTypeIdentifier, teamIdentifier, etc) 
function createTemplate(style, fields) {
  return new Template(style, fields);
}


// Create a new template.
//
// style  - Passbook style (coupon, eventTicket, etc)
// fields - Passbook fields (passTypeIdentifier, teamIdentifier, etc) 
function Template(style, fields) {
  if (!~STYLES.indexOf(style))
    throw new Error("Unsupported passbook style " + style);
  this.style = style;
  this.fields = cloneObject(fields);
  this.keysPath = "keys";
}

// Sets path to directory containing keys and password for accessing keys.
//
// path     - Path to directory containing key files (default is 'keys')
// password - Password to use with keys
Template.prototype.keys = function(path, password) {
  if (path)
    this.keysPath = path;
  if (password)
    this.password = password;
}

// Create a new passbook from a template.
Template.prototype.createPassbook = function(fields) {
  // Combine template and passbook fields
  var combined = {};
  for (var key in this.fields)
    combined[key] = this.fields[key];
  for (var key in fields)
    combined[key] = fields[key];
  return new Passbook(this, combined);
}

// Accessor methods for template fields.
//
// Call with an argument to set field and return self, call with no argument to
// get field value.
//
//   template.passTypeIdentifier("com.example.mypass");
//   console.log(template.passTypeIdentifier());
TEMPLATE.forEach(function(key) {
  Template.prototype[key] = function(value) {
    if (arguments.length == 0) {
      return this.fields[key];
    } else {
      this.fields[key] = value;
      return this;
    }
  }
});


// Create a new passbook.
//
// tempplate  - The template
// fields     - Passbook fields (description, serialNumber, logoText)
function Passbook(template, fields) {
  this.template = template;
  this.fields = cloneObject(fields);
  // Structure is basically reference to all the fields under a given style
  // key, e.g. if style is coupon then structure.primaryFields maps to
  // fields.coupon.primaryFields.
  var style = template.style;
  this.structure = this.fields[style];
  if (!this.structure)
    this.structure = this.fields[style] = {};
  this.images = {};
  this.files = [];
}

// Accessor methods for top-level fields (description, serialNumber, logoText,
// etc).
//
// Call with an argument to set field and return self, call with no argument to
// get field value.
//
//   passbook.description("Unbelievable discount");
//   console.log(passbook.description());
TOP_LEVEL.forEach(function(key) {
  Passbook.prototype[key] = function(value) {
    if (arguments.length == 0) {
      return this.fields[key];
    } else {
      this.fields[key] = value;
      return this;
    }
  }
});

// Accessor methods for structure fields (primaryFields, backFields, etc).
//
// Call with an argument to set field and return self, call with no argument to
// get field value.
//
//   passbook.headerFields({ key: "time", value: "10:00AM" });
//   console.log(passbook.headerFields());
STRUCTURE.forEach(function(key) {
  Passbook.prototype[key] = function(value) {
    if (arguments.length == 0) {
      return this.structure[key];
    } else {
      this.structure[key] = value;
      return this;
    }
  }
});

// Accessor methods for images (logo, strip, etc).
//
// Call with an argument to set the image and return self, call with no
// argument to get image value.
//
//   passbook.icon(function(callback) { ... };
//   console.log(passbook.icon());
//
// The 2x suffix is used for high resolution version (file name uses @2x
// suffix).
//
//   passbook.icon2x("icon@2x.png");
//   console.log(passbook.icon2x());
IMAGES.forEach(function(key) {
  Passbook.prototype[key] = function(value) {
    if (arguments.length == 0) {
      return this.images[key];
    } else {
      this.images[key] = value;
      return this;
    }
  }
  var double = key + "2x";
  Passbook.prototype[double] = function(value) {
    if (arguments.length == 0) {
      return this.images[double];
    } else {
      this.images[double] = value;
      return this;
    }
  }
});

// Load all images from the specified directory. Only supported images are
// loaded, nothing bad happens if directory contains other files.
//
// path - Directory containing images to load
Passbook.prototype.loadImagesFrom = function(path) {
  var self = this;
  var files = File.readdirSync(path);
  files.forEach(function(filename) {
    var basename = Path.basename(filename, ".png");
    if (/@2x$/.test(basename) && ~IMAGES.indexOf(basename.slice(0, -3))) {
      // High resolution
      self.images[basename.replace(/@2x/, "2x")] = Path.resolve(path, filename);
    } else if (~IMAGES.indexOf(basename)) {
      // Normal resolution
      self.images[basename] = Path.resolve(path, filename);
    }
  });
  return this;
}

// Validate passbook, throws error if missing a mandatory top-level field or image.
Passbook.prototype.validate = function() {
  for (var i in REQUIRED_TOP_LEVEL) {
    var key = REQUIRED_TOP_LEVEL[i];
    if (!this.fields[key])
      throw new Error("Missing field " + key);
  }
  for (var i in REQUIRED_IMAGES) {
    var key = REQUIRED_IMAGES[i];
    if (!this.images[key])
      throw new Error("Missing image " + key + ".png");
  }
}

// Returns the pass.json object (not a string).
Passbook.prototype.getPassbookJSON = function() {
  var fields = cloneObject(this.fields);
  fields.formatVersion = 1;
  return fields;
}

// Generate the passbook.
//
// Callback receives:
// error  - Something went wrong
// buffer - Contents of Passbook (Buffer)
Passbook.prototype.generate = function(callback) {
  var self = this;

  // Validate before attempting to create
  try {
    this.validate();
  } catch (error) {
    callback(error);
    return;
  }

  // Create pass.json
  var passJson = new Buffer(JSON.stringify(this.getPassbookJSON()), "utf-8");

  // Get image from key
  function getImage(key, done) {
    var image = self.images[key];
    if (typeof image == "string" || image instanceof String) {
      // image is a filename, load from disk
      File.readFile(image, function(error, buffer) {
        if (!error)
          self.images[key] = buffer;
        done(error, buffer);
      });
    } else if (image instanceof Buffer) {
      done(null, image);
    } else if (typeof image == "function") {
      // image is a function, call it to obtain image
      try {
        image(function(error, buffer) {
          if (!error)
            self.images[key] = buffer;
          done(error, buffer);
        });
      } catch (error) {
        done(error);
      }
    } else if (image) {
      // image is not a supported type
      done(new Error("Cannot load image " + key + ", must be String (filename), Buffer or function"));
    } else
      done();
  }

  // Add next pair of images from the list of keys
  function addNextImage(imageKeys, files, done) {
    var imageKey = imageKeys[0];
    if (imageKey) {
      // Add normal resolution
      getImage(imageKey, function(error, buffer) {
        if (error) {
          done(error);
        } else {
          if (buffer) {
            files[imageKey + ".png"] = buffer;
          }
          // Add high resolution
          getImage(imageKey + "2x", function(error, buffer) {
            if (error) {
              done(error);
            } else {
              if (buffer)
                files[imageKey + "@2x.png"] = buffer;
              addNextImage(imageKeys.slice(1), files, done);
            }
          });
        }
      });
    } else
      done();
  }

  // These are all the files that will show in the manifest
  var files = { "pass.json": passJson };
  // Start adding all the images
  addNextImage(IMAGES, files, function(error) {
    if (error) {
      callback(error);
    } else {
      // Now that we have a map of all the images, add them to the zip
      Object.keys(files).forEach(function(filename) {
        self.files.push({ name: filename, content: files[filename] });
      });

      // Calculate the manifest and add it as well
      var manifest = createManifest(files);
      self.files.push({
        name: "manifest.json",
        content: new Buffer(manifest, "utf-8")
      });

      // Sign the manifest and add the signature
      signManifest(self.template, manifest, function(error, signature) {
        if (error) {
          callback(error);
        } else {
          self.files.push({ name: "signature", content: signature });
          // Create Zip file
          var zip = new archiver.createZip({ level: 1});
          var buffers = [];

          zip.on('data', function (data) {
            buffers.push(data);
          })

          zip.on('error', function (err) {
            callback(err);
          })

          // Add each file in zip
          async.forEachSeries(self.files, function (file, cb) {
            zip.addFile(file.content, { name: file.name }, cb);
          }, function (err) {
            if (err) {
              return callback(error);
            }
            zip.finalize(function () {
              callback(null, Buffer.concat(buffers));
            })
          })
        }
      });
    }
  });

}

// Creates a manifest from map of files. Returns as a string.
function createManifest(files) {
  var manifest = {};
  for (var filename in files) {
    var file = files[filename];
    var sha = Crypto.createHash("sha1").update(file).digest("hex");
    manifest[Path.basename(filename)] = sha;
  }
  return JSON.stringify(manifest);
}

// Signs a manifest and returns the signature.
function signManifest(template, manifest, callback) {
  var identifier = template.passTypeIdentifier().replace(/^pass./, "");

  var args = [
    "smime",
    "-sign", "-binary",
    "-signer",    Path.resolve(template.keysPath, identifier + ".pem"),
    "-certfile",  Path.resolve(template.keysPath, "wwdr.pem"),
  ];
  args.push("-passin", "pass:" + template.password)
  var sign = execFile("openssl", args, { stdio: "pipe" }, function(error, stdout, stderr) {
    if (error) {
      callback(new Error(stderr));
    } else {
      var signature = stdout.split(/\n\n/)[3];
      callback(null, new Buffer(signature, "base64"));
    }
  });
  sign.stdin.write(manifest);
  sign.stdin.end();
}

// Clone an object by copying all its properties and returning new object.
// If the argument is missing or null, returns a new object.
function cloneObject(object) {
  var clone = {};
  if (object) {
    for (var key in object)
      clone[key] = object[key];
  }
  return clone;
}


module.exports = createTemplate;
