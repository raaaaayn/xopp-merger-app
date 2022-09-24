// gzip library
import zlib from "node:zlib";

// data libraries
import { XMLParser, XMLBuilder } from "fast-xml-parser";

const xml_options = {
    ignoreAttributes: false,
    allowBooleanAttributes: true,
    preserveOrder: true,
};

function mergeFiles(data) {
    const xmlParser = new XMLParser(xml_options);
    const xmlBuilder = new XMLBuilder(xml_options);

    const jsonFiles = data.files.map((obj) => {
        // strip base64 header and convert to a buffer
        let buffer = new Buffer(obj.file.slice(31), "base64");
        // decompress the file
        let xmlData = zlib.gunzipSync(buffer);
        // parse xml as json
        return xmlParser.parse(xmlData);
    });

    // we will modify first file and use it as output
    const outputJSON = jsonFiles[0];
    // copy all pages from the other files
    for (let i = 1; i < jsonFiles.length; i++) {
        const fileNotebook = jsonFiles[i][1]["xournal"];
        const pages = fileNotebook.slice(2);
        outputJSON[1]["xournal"] = [...outputJSON[1]["xournal"], ...pages];
    }
    // build xml
    const outputXML = xmlBuilder.build(outputJSON);
    // compress the data
    return zlib.gzipSync(outputXML);
}

export default mergeFiles;