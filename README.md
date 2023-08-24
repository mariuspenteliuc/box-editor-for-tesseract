Web-Based Box Editor for Tesseract OCR
--------------

Web app for editing Tesseract OCR LSTM box files in WordStr format, using [Tesseract OCR js](https://tesseract.projectnaptha.com), [leaflet mapping library](http://leafletjs.com), and [leaflet.draw](https://github.com/Leaflet/Leaflet.draw).

[![pages-build-deployment](https://github.com/mariuspenteliuc/box-editor-for-tesseract/actions/workflows/pages/pages-build-deployment/badge.svg?branch=production)](https://github.com/mariuspenteliuc/box-editor-for-tesseract/actions/workflows/pages/pages-build-deployment)

![screenshot](img/app-screenshot-4-min.png)


### Features
* Automatically detects text lines;
* Supports for adding, editing, and deleting bounding boxes;
* May take existing box files;
* Exports box files and tagged text;
* Highlights characters according to regex patterns;
* Notifies of potential issues and errors;
* Indicates document tagging progress;
* Shows character Unicode info popup;
* Allows choosing language model;
* Shows text suggestion confidence;
* Displays invisible characters;
* Has built-in samples;
* Remembers preferences;
* Supports Dark Mode.

### How to use
1. Upload an image and wait for bounding boxes to be automatically generated.
  - optionally, upload an existing box file to edit.
2. Correct generated bounding boxes.
  - add new boxes using the draw tool;
  - remove boxes using the delete tool;
  - edit boxes by clicking on them and dragging the handles, or adjusting the `Left`, `Bottom`, `Right`, and `Top` input fields.
3. Type the ground-truth into the text field.
4. Press `Return` or the `Next` button to commit the current text line.
5. Download the edited box file using the `Download` button.

Keyboard shortcuts are available to navigate forward `control + shift + down` and backward `control + shift + up`.
NOTE: Keyboard shortcuts implementation is buggy and needs fixing.

### Acknowledgment
This work was supported by a grant from the Ministry of Research, Innovation and Digitization, CCCDI - UEFISCDI, project number PN-III-P2-2.1-PED-2021-0693, within PNCDI III.

Project website: [https://transitional-romanian-transliteration.azurewebsites.net](https://transitional-romanian-transliteration.azurewebsites.net)

----------
Original Source Code by [Johan Junkka](http://johanjunkka.com/).
