# Get your certificates

To start with, you'll need a certificate issued by [the iOS Provisioning
Portal](https://developer.apple.com/ios/manage/passtypeids/index.action).  You
need one certificate per Passbook Type ID.

After adding this certificate to your Keychain, you need to export it as a
`.p12` file and copy it into the keys directory.

You will also need the 'Apple Worldwide Developer Relations Certification
Authority' certificate and to conver the `.p12` files into `.pem` files.  You
can do both using the `node-passbook prepare-keys` command:

```sh
node-passbook prepare-keys -p keys
```

This is the same directory into which you placet the `.p12` files.


# Start with a template

Start with a template.  A template has all the common data fields that will be
shared between your passes, and also defines the keys to use for signing it.

```js
var createTemplate = require("passbook");

var template = createTemplate("coupon", {
  passTypeIdentifier: "pass.com.example.passbook",
  teamIdentifier:     "MXL",
  backgroundColor:   "rgb(255,255,255)"
});
```

The first argument is the pass style (`coupon`, `eventTicket`, etc), and the
second optional argument has any fields you want to set on the template.

You can access template fields directly, or from chained accessor methods, e.g:

```js
template.fields.passTypeIdentifier = "pass.com.example.passbook";

console.log(template.passTypeIdentifier());

template.teamIdentifier("MXL").
  passTypeIdentifier("pass.com.example.passbook")
```

The following template fields are required:
`passTypeIdentifier`  - The Passbook Type ID, begins with "pass."
`teamIdentifier`      - May contain an I

Optional fields that you can set on the template (or pass): `backgroundColor`,
`foregroundColor`, `labelColor`, `logoText`, `organizationName`,
`suppressStripShine` and `webServiceURL`.

In addition, you need to tell the template where to find the key files and where
to load images from:

```js
template.keys("/etc/passbook/keys", "secret");
template.loadImagesFrom("images");
```

The last part is optional, but if you have images that are common to all passes,
you may want to specify them once in the template.


# Create your pass

To create a new pass from a template:

```js
var pass = template.createPass({
  serialNumber:  "123456",
  description:   "20% off"
});
```

Just like template, you can access pass fields directly, or from chained
accessor methods, e.g:

```js
pass.fields.serialNumber = "12345";
console.log(pass.serialNumber());
pass.serialNumber("12345").
  description("20% off");
```

In the JSON specification, structure fields (primary fields, secondary fields,
etc) are represented as arrays, but items must have distinct key properties.  Le
sigh.

To make it easier, you can use methods like `add`, `get` and `remove` that
will do the logical thing.  For example, to add a primary field:

```js
pass.primaryFields.add("date", "Date", "Nov 1");
pass.primaryFields.add({ key: "time", label: "Time", value: "10:00AM"});
```

You can also call `add` with an array of triplets or array of objects.

To get one or all fields:

```js
var dateField = pass.primaryFields.get("date");
var allFields = pass.primaryFields.all();
```

To remove one or all fields:

```js
pass.primaryFields.remove("date");
pass.primaryFields.clear();
```

Adding images to a pass is the same as adding images to a template:

```js
pass.images.icon = iconFilename;
pass.icon(iconFilename);
pass.loadImagesFrom("images");
```

You can add the image itself (a `Buffer`), or provide the name of a file or an
HTTP/S URL for retrieving the image.  You can also provide a function that will
be called when it's time to load the image, and should pass an error, or `null`
and a buffer to its callback.


Additionally localizations can be added if needed:
```js
pass.addLocalization("en", {
  "GATE": "GATE",
  "DEPART": "DEPART",
  "ARRIVE": "ARRIVE",
  "SEAT": "SEAT",
  "PASSENGER": "PASSENGER",
  "FLIGHT": "FLIGHT"
});

pass.addLocalization("ru", {
  "GATE": "ВЫХОД",
  "DEPART": "ВЫЛЕТ",
  "ARRIVE": "ПРИЛЁТ",
  "SEAT": "МЕСТО",
  "PASSENGER": "ПАССАЖИР",
  "FLIGHT": "РЕЙС"
});
```

Localization applies for all fields' `label` and `value`. There is a note about that in [documentation](https://developer.apple.com/library/ios/documentation/UserExperience/Conceptual/PassKit_PG/Creating.html). 

# Generate the file

To generate a file:

```js
var file = fs.createWriteStream("mypass.pkpass");
pass.on("error", function(error) {
  console.error(error);
  process.exit(1);
})
pass.pipe(file);
```

Your pass will emit the `error` event if it fails to generate a valid Passbook
file, and emit the `end` event when it successfuly completed generating the
file.

You can pipe to any writeable stream.  When working with HTTP, the `render`
method will set the content type, pipe to the HTTP response, and make use of a
callback (if supplied).

```js
server.get("/mypass", function(request, response) {
  pass.render(response, function(error) {
    if (error)
      console.error(error);
  });
});
```
