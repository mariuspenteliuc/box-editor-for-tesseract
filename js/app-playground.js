window.app = {
  handler: {}
};

class Box {
  constructor({ text, x1, x2, y1, y2, polyid, visited = false }) {
    this.text = text;
    this.x1 = x1;
    this.x2 = x2;
    this.y1 = y1;
    this.y2 = y2;
    this.polyid = polyid;
    this.filled = text != '' ? true : false;
    this.visited = visited;
    this.committed = false;
  }

  static compare(a, b) {
    const
      tolerance = 0.5,
      xOverlap = a.x1 <= b.x2 && b.x1 <= a.x2,
      below = a.y1 > b.y2 - tolerance * (b.y2 - b.y1),
      left = a.x2 <= b.x1,
      cOverlap = (c) => c.x1 <= a.x2 && a.x1 <= c.x2 && c.x1 <= b.x2 && b.x1 <= c.x2,
      aOverflows = a.y1 === b.y2 && xOverlap;

    // Rule 1: Line segment a comes before line segment b
    // if their ranges of x-coordinates overlap and if a is below b
    if (xOverlap && below) {
      return -1;
    }

    // Rule 2: Line segment a comes before line segment b
    // if a is entirely to the left of b and no line segment c overlaps
    // both a and b
    if (left && !cOverlap(a) && !cOverlap(b)) {
      return -1;
    }

    // Rule 3: Line segment a comes before line segment b
    // if line segment a overflows to the next line (line segment b)
    if (aOverflows) {
      return -1;
    }

    return 1;
  }

  equals(other) {
    return this.text == other.text && this.x1 == other.x1 && this.y1 == other.y1 && this.x2 == other.x2 && this.y2 == other.y2
  }
}

// ready event
app.ready = async function () {
  // selector cache

  var
    $document = $(document),
    $window = $(window),
    $html = $('html'),
    $body = $('body'),
    $imageFileInput = $('#imageFile'),
    $checkboxes = $('.ui.checkbox'),
    $groundTruthInputFieldContainer = $('#myInputContainer'),
    $fields = $($('input, .field'), $groundTruthInputFieldContainer),
    $buttons = $('button, .ui.button'),
    $map = $('#mapid'),
    $popups = $('.popup'),
    $output = $('#text-output'),
    $regenerateTextSuggestionForSelectedBoxButton = $('#regenerateTextSuggestionForSelectedBox'),
    $redetectAllBoxesButton = $('#redetectAllBoxes'),
    $regenerateTextSuggestionsButton = $('#regenerateTextSuggestions'),
    $settingsModal = $('.ui.settings.modal'),
    $settingsModalStatus = $('#settingsModalStatus'),
    $settingsModalStatusMessage = $settingsModalStatus.find('.ui.disabled.tertiary.button'),
    $settingsMenuNav = $('#settingsMenu'),
    $settingsMenuItems = $settingsMenuNav.find('.item'),
    $settingsMenuPane = $('#mainSettingsPane'),
    $settingsMenuPaneTabs = $settingsMenuPane.find('.ui.tab'),
    $settingsButton = $('#settingsButton'),
    $settingsButtonForHelpPane = $('.helpSettingsPopup'),
    $resetButton = $('#resetAppSettings'),
    $useSampleImageButton = $('#useSampleImage'),
    $useSampleImagePopupTrigger = $('#uploadNewImage'),
    $useSamplePopup = $('.ui.useSampleImage.popup'),
    $dropzone = $('div.my-dropzone'),
    $dropzoneParentSegment = $('.dropzoneSegment'),
    $appInfoVersion = $('#appInfoVersion'),
    $appInfoUpdated = $('#appInfoUpdated'),
    $toggleOutputScriptButton = $('#toggleOutputScript'),
    $copyToClipboardButton = $('#copyOutputToClipboard'),
    $saveOutputToDisk = $('#saveOutputToDisk'),
    $detectAllLinesCheckbox = $(`input[name='behavior.onImageLoad.detectAllLines']`),
    $imageViewHeightSlider = $('#imageViewHeightSlider'),
    $balancedText = $('.balance-text, p, .header'),

    // variables
    pressedModifiers = {},
    _URL = window.URL || window.webkitURL,
    bounds,
    BoxFileType = Object.freeze({
      'WORDSTR': 1,
      'CHAR_OR_LINE': 2,
    }),
    boxFileType = BoxFileType.WORDSTR,
    boxLayer = new L.FeatureGroup(),
    selectedPoly,
    selectedBox,
    languageModelName = 'RTS_from_Cyrillic',
    maxZoom = 1,
    map,
    mapPaddingBottomLeft = [40, 0],
    imageFileName,
    imageFileNameForButton,
    boxData = [],
    boxDataInfo = {
      dirty: false,
      isDirty: function () {
        return this.dirty;
      },
      setDirty: function (value = true) {
        this.dirty = value;
      }
    },
    imageFile,
    imageFileInfo = {
      processed: false,
      isProcessed: function () {
        return this.processed;
      },
      setProcessed: function () {
        this.processed = true;
      },
      setUnprocessed: function () {
        this.processed = false;
      },
    },
    recognizedLinesOfText = [],
    image,
    imageHeight,
    imageWidth,
    mapState = undefined,
    worker,
    ocrOutput = "",
    transliteratedOutput = "",

    appSettings = {
      localStorageKey: 'appSettings-playground',
      appVersion: null,
      interface: {
        appearance: 'match-device',
        imageView: 'medium',
        displayText: 'transliteration',
      },
      behavior: {
        onImageLoad: {
          detectAllLines: true,
        },
        highlighter: {
          textHighlighting: {
            textHighlightingEnabled: true,
            highlightsPatterns: [],
          },
        },
      },
    },

    boxState = {
      boxProcessing: {
        color: 'white',
        weight: 1,
        stroke: true,
        opacity: 0.5,
        fillOpacity: 0.3,
      },
      boxActive: {
        color: 'red',
        weight: 3,
        stroke: true,
        opacity: 0.5,
        fillOpacity: 0,
      },
      boxInactive: {
        color: 'gray',
        stroke: true,
        weight: 1,
        opacity: 0.5,
        fillOpacity: 0.3,
      },
      boxComitted: {
        color: 'green',
        stroke: false,
        fillOpacity: 0.3,
      },
    },

    // alias
    handler
    ;

  // event handler

  handler = {
    getAppInfo: function () {
      // get details from ../../app-version.json
      appInfo = JSON.parse($.ajax({
        url: "../../app-version.json",
        async: false,
        dataType: "json"
      }).responseText);
      appInfo.appName = appInfo.name.replace(/[^\w\s]/gi, '');
      return appInfo;
    },
    compareVersions: function (a, b) {
      return compareVersions.compareVersions(a, b);
    },
    migrateSettings: function (oldSettings, downgrade = false) {
      if (downgrade) {
        // Downgrading settings

        // ignore newer settings
      } else {
        // Upgrading settings

        if (handler.compareVersions(oldSettings.appVersion, '1.6.2') < 0) {
          // migrate map height labels to numbers
          var oldHeightLabels = {
            'short': 300,
            'medium': 500,
            'tall': 700
          };
          if (oldSettings.interface?.imageView) {
            appSettings.interface.imageView = oldHeightLabels[oldSettings.interface.imageView]
          } else {
            appSettings.interface.imageView = 500;
          }
        }

        if (handler.compareVersions(oldSettings.appVersion, '1.6.0') < 0) {
          // clear cookies set by versions prior to 1.6.0
          // also remove html script tag for JS Cookie
          const cookies = Cookies.get();
          for (const cookie in cookies) {
            Cookies.remove(cookie);
          }
        }
      }
      return appSettings;
      // return oldSettings.appVersion == 0 ? appSettings : oldSettings;
    },
    update: {
      localStorage: function () {
        localStorage.setItem(appSettings.localStorageKey, JSON.stringify(appSettings));
      },
      appSettings: function ({ path, value, localStorage }) {
        if (localStorage) {
          if (localStorage.appVersion == undefined) {
            localStorage.appVersion = '0';
          }
          switch (handler.compareVersions(appSettings.appVersion, localStorage.appVersion)) {
            case -1:
              appSettings = handler.migrateSettings(localStorage, true);
              break;
            case 1:
              appSettings = handler.migrateSettings(localStorage);
              break;
            default:
              appSettings = localStorage;
              break;
          }
          handler.update.localStorage();
        } else {
          var
            pathElements = path.split('.'),
            button = document.createElement('div'),
            status = document.createElement('div'),
            inlineLoader = document.createElement('div'),
            lastElementIndex = pathElements.length - 1,
            updatedSettings = pathElements.reduce((obj, key, index) => {
              if (index === lastElementIndex) {
                obj[key] = value;
              } else {
                obj[key] = { ...obj[key] };
              }
              return obj[key];
            }, appSettings);
          handler.update.localStorage();
          button.className = 'ui button ok';
          button.tabIndex = '0';
          button.innerText = 'OK';
          status.className = 'ui disabled tertiary button';
          status.innerText = 'Settings saved!';
          inlineLoader.className = 'ui tiny active grey fast inline double loader';

          setTimeout(() => {
            $settingsModalStatus[0].innerHTML = '';
            $settingsModalStatus[0].appendChild(status);
            $settingsModalStatus[0].appendChild(button);
            $settingsModalStatusMessage = $settingsModalStatus.find('.ui.disabled.tertiary.button');
          }, 300)
          $settingsModalStatus[0].innerHTML = '';
          $settingsModalStatus[0].appendChild(inlineLoader);
          $settingsModalStatus[0].appendChild(status);
          $settingsModalStatus[0].appendChild(button);

        }
        handler.update.settingsModal();
      },
      settingsModal: async function () {
        // Appearance
        const appearancePath = 'interface.appearance';
        document.querySelector(`input[name='${appearancePath}'][value='${appSettings.interface.appearance}']`).checked = true;
        handler.set.appAppearance(appSettings.interface.appearance);
        // Image View
        const imageViewPath = 'interface.imageView';
        $imageViewHeightSlider.slider('set value', appSettings.interface.imageView, fireChange = false);
        if (appSettings.interface.imageView < 300) {
          // find item with text 'Tiny'
          $imageViewHeightSlider.find('.label').each(function () {
            if (this.innerText == 'Tiny') {
              // append span element with additional text
              this.innerHTML += '<span class="ui italic grey text">&nbsp;– Some editor buttons will be clipped.</span>';
            }
          });
        }
        handler.set.mapSize({ height: appSettings.interface.imageView });
        // Output Script
        if (appSettings.interface.displayText == 'rts') {
          $toggleOutputScriptButton.find('span').text('Transliteration');
          // $toggleOutputScriptButton.setAttribute('data-tooltip', 'Switch to recognized RTS text');
        } else {
          $toggleOutputScriptButton.find('span').text('RTS');
          // $toggleOutputScriptButton.setAttribute('data-tooltip', 'Switch to transliterated text');
        }
        // On Image Load
        for (const [key, value] of Object.entries(appSettings.behavior.onImageLoad)) {
          const path = 'behavior.onImageLoad.' + key;
          document.querySelector(`input[name='${path}']`).checked = value;
        }
      },
      rectangle: function (polyid, data) {
        var
          box = boxLayer.getLayer(polyid);
        box.setBounds([[data.y1, data.x1], [data.y2, data.x2]]);
      },
    },
    load: {
      sampleImageAndBox: async function (event) {
        handler.load.imageFile(event, true);
        handler.close.settingsModal();
        $dropzone
          .dimmer('hide')
          .removeClass('raised');
      },
      eventListeners: function () {
        $settingsModal[0].addEventListener('change', function (event) {
          const
            path = event.target.name,
            value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
          handler.update.appSettings({ path: path, value: value });
        });
      },
      sliders: function () {
        var labels = ["Tiny", "Short", "Normal", "Tall", "Huge"];
        $imageViewHeightSlider.slider({
          min: 100,
          max: 900,
          step: 200,
          autoAdjustLabels: false,
          interpretLabel: function (value) {
            return labels[value];
          },
          onChange: function (value) {
            if (value < 300) {
              // find item with text 'Tiny'
              $imageViewHeightSlider.find('.label').each(function () {
                if (this.innerText == 'Tiny') {
                  // append span element with additional text
                  this.innerHTML += '<span class="ui italic grey text">&nbsp;– Some editor buttons will be clipped.</span>';
                }
              });
            } else {
              // remove span element from label
              $imageViewHeightSlider.find('.label').each(function () {
                if (this.innerText.includes('Tiny')) {
                  this.innerHTML = 'Tiny';
                }
              });
            }

            handler.set.mapSize({ height: value });
            // appSettings.interface.imageView = value;
            handler.update.appSettings({ path: 'interface.imageView', value: value });
          },
        });
      },
      settings: function () {
        handler.getAppInfo();
        $appInfoVersion.text(appInfo.version);
        appSettings.appVersion = appInfo.version;
        // format date to month date, year
        const date = new Date(appInfo.updated);
        $appInfoUpdated.text(handler.formatDate(date));
        $settingsMenuItems.tab({
          onload: function () {
            balanceText.updateWatched();
          }
        });
        $settingsModal.modal({
          inverted: false,
          blurring: true,
          onHidden: function () {
            // hide status if still visible
            if ($settingsModalStatusMessage[0]) $settingsModalStatusMessage[0].innerHTML = '';
          }
        });
        const localStorageValue = localStorage.getItem(appSettings.localStorageKey);
        if (localStorageValue) {
          localStorageSettings = JSON.parse(localStorageValue);
          handler.update.appSettings({ localStorage: localStorageSettings });
        } else {
          handler.update.appSettings({ localStorage: { appVersion: undefined } });
          handler.update.settingsModal();
        }
      },
      imageFile: async function (e, sample = false) {
        handler.set.loadingState({ buttons: true });

        var
          defaultImageUrl = '../../assets/sampleImage.jpg',
          img = new Image(),
          imageOverlayOptions = {
            opacity: appSettings.behavior.onImageLoad.detectAllLines ? 0.25 : 1
          };
        if (sample) {
          imageFileName = defaultImageUrl.split('/').pop().split('.').slice(0, -1).join('.');
          imageFileNameForButton = defaultImageUrl;
          filename = defaultImageUrl.split('/').pop();
        } else if (e.type.includes('image')) {
          imageFileName = e.name.split('.').slice(0, -1).join('.');
          imageFileNameForButton = e;
          filename = e.name;
          file = e;
        } else if (file = this.files[0]) {
          imageFileName = file.name.split('.').slice(0, -1).join('.');
          imageFileNameForButton = file;
          filename = file.name;
        }
        img.onload = async function () {
          if (!map) {
            handler.create.map('mapid');
          }
          map.eachLayer(function (layer) {
            map.removeLayer(layer);
          });

          imageHeight = this.height;
          imageWidth = this.width;
          handler.clearOutput();

          bounds = [[0, 0], [parseInt(imageHeight), parseInt(imageWidth)]];
          var bounds2 = [[imageHeight - 300, 0], [imageHeight, imageWidth]];
          if (image) {
            $(image._image).fadeOut(750, function () {
              map.removeLayer(image);
              image = new L.imageOverlay(img.src, bounds, imageOverlayOptions).addTo(map);
              $(image._image).fadeIn(500);
            });
          } else {
            map.fitBounds(bounds2);
            image = new L.imageOverlay(img.src, bounds, imageOverlayOptions).addTo(map);
            $(image._image).fadeIn(750);
          }
        };
        img.onerror = function (error) {
          var fileExtension = file.name.split('.').pop();
          handler.notifyUser({
            title: 'Invalid File Type',
            message: 'Expected image file. Received ' + fileExtension + ' file.',
            type: 'error',
          });
          $imageFileInput.val(imageFileNameForButton);
        };
        if (sample) {
          img.src = defaultImageUrl;
        } else {
          img.src = _URL.createObjectURL(file);
        }
        worker = await Tesseract.createWorker({
          logger: m => handler.process.workerLogMessage(m),
          langPath: '../../assets',
          gzip: false,
        });
        await worker.loadLanguage(languageModelName);
        await worker.initialize(languageModelName);
        await worker.setParameters({
          tessedit_ocr_engine_mode: 1,
          tessedit_pageseg_mode: 1,// 12
        });
        if ($detectAllLinesCheckbox[0].checked) {
          var response = await handler.generate.initialBoxes();
        }
        handler.set.loadingState({ main: false, buttons: false });
        $(image._image).animate({ opacity: 1 }, 500);
        imageFileInfo.setProcessed();
      },
      popups: function () {
        $useSampleImagePopupTrigger.popup({
          popup: $useSamplePopup,
          position: 'top left',
          hoverable: true,
          delay: {
            hide: 800,
          }
        })
      },
      dropzone: function () {
        $dropzone.dropzone({
          url: handler.receiveDroppedFiles,
          uploadMultiple: true,
          parallelUploads: 3,
          disablePreviews: true,
          clickable: false,
          acceptedFiles: "image/*",
          createImageThumbnails: false,
        });
        $html.on('drag dragenter dragover', function (event) {
          event.preventDefault();
          event.stopPropagation();

          if ($html.hasClass('dz-drag-hover')) {
            // $dropzone
            // .dimmer('show')
            // .addClass('raised');
          }
          window.setTimeout(function () {
            if (!$html.hasClass('dz-drag-hover')) {
              // $dropzone
              //   .dimmer('hide')
              //   .removeClass('raised');
            }
          }, 1500);
        });
        $dropzone.on('drag dragenter dragover', function (event) {
          event.preventDefault();
          event.stopPropagation();
          $dropzone
            .dimmer('show');
          $dropzoneParentSegment
            .addClass('raised');
        });
        $dropzone.on('dragleave dragend', function (event) {
          event.preventDefault();
          event.stopPropagation();
          // $dropzone
          //   .dimmer('hide')
          $dropzoneParentSegment
            .removeClass('raised');
        });
        $html.on('drop', function (event) {
          event.preventDefault();
          event.stopPropagation();
        });
        $dropzone.on('drop', function (event) {
          event.preventDefault();
          event.stopPropagation();
          var fileCount = $dropzone[0].dropzone.getAcceptedFiles().length;
          if (fileCount == 0) {
            handler.notifyUser({
              title: 'Invalid File Type',
              message: 'You can only upload an image.',
              type: 'error',
            });
          }
          if (fileCount != 1) {
            $dropzone
              .transition('shake');
            return;
          }
          if (!$html.hasClass('dz-drag-hover')) {
            $dropzone
              .dimmer('hide')
              .transition('pulse');
          }
        });
      },
    },
    set: {
      appAppearance: function (value) {
        var docClassesRef = $document[0].documentElement.classList;
        docClassesRef.remove(...docClassesRef);
        docClassesRef.toggle(value);
      },
      mapResize: async function (height, animate) {
        // TODO: refresh jquery selector. It does not work even though it shoud.
        // $map[0].animate({ height: height }, animate ? 500 : 0);
        $('#mapid').animate({ height: height }, animate ? 500 : 0);
      },
      mapSize: async function (options, animate = true) {
        await handler.set.mapResize(options.height, animate);

        if (selectedPoly != undefined) {
          selectedPoly
            .getBounds()
            .extend(selectedPoly.getBounds());
        }
      },
      loadingState: function (object) {
        if (object.main != undefined) {
          if (object.main) {
            $map.addClass('loading disabled');
            if (image != undefined) {
              $(image._image).animate({ opacity: 0.3 }, 200);
            }
          } else {
            $map.removeClass('loading disabled');
            if (image != undefined) {
              $(image._image).animate({ opacity: 1 }, 500);
            }
          }
        }
        if (object.buttons != undefined) {
          if (object.buttons) {
            $fields
              .each(function () {
                $(this)
                  .prop('disabled', true)
                  .addClass('disabled');
              });
            $buttons
              .each(function () {
                $(this)
                  .prop('disabled', true)
                  .addClass('disabled');
              });
          } else {
            $fields
              .each(function () {
                $(this)
                  .prop('disabled', false)
                  .removeClass('disabled');
              });
            $buttons
              .each(function () {
                $(this)
                  .prop('disabled', false)
                  .removeClass('disabled');
              });
          }
        }
      },
    },
    process: {
      workerLogMessage: function (message) {
        if (message.status == 'recognizing text') {
          message.type = 'ocr';
        } else {
          message.type = 'initializingWorker';
        }
        console.log(message);
        return message;
      },
      text: function (text, callback) {
        // read json file
        fetch("../../assets/transliterationRules.json")
          .then((response) => response.json())
          .then((json) => {
            let transliterationRules = json["transliteration-rules"],
              transliteratedText = [],
              line = text;
            line = unorm.nfc(text).replace(/[\u0300-\u036F\u1DC0-\u1DFF]/g, "");

            line = Array.from(line)
              .filter((c) => !/[\u0300-\u036F\u1DC0-\u1DFF]/.test(c))
              .join("");

            let transliteratedLine = handler.applyTransliterationRules(
              line,
              transliterationRules
            );
            transliteratedText.push(transliteratedLine);
            // }
            transliteratedOutput = transliteratedText[0];
            callback(transliteratedText[0]);
            // return transliteratedText[0];
          })
          .catch((error) => console.error(error));
      },
    },
    create: {
      map: function (name) {
        map = new L.map(name, {
          crs: L.CRS.Simple,
          minZoom: -2,
          center: [0, 0],
          zoom: 0,
          zoomSnap: .5,
          scrollWheelZoom: true,
          touchZoom: true,
          zoomControl: false,
          drawControl: false,
          attributionControl: false,
          preferCanvas: true,
          maxBoundsViscosity: .5,
        });

        var
          zoomControl = new L.Control.Zoom({ position: 'topleft' }),
          // modifiedDraw = new L.drawLocal.extend({
          //   draw: {
          //     toolbar: {
          //       buttons: {
          //         polygon: 'Draw an awesome polygon'
          //       }
          //     }
          //   }
          // }),
          drawControl = new L.Control.Draw({
            draw: {
              polygon: false,
              marker: false,
              circle: false,
              polyline: true,
              rectangle: true,
              circlemarker: false
            },
            position: 'topleft',
            edit: {
              featureGroup: boxLayer,
              edit: false,
              remove: true
            }
          });

        map.addControl(zoomControl);
        map.addControl(drawControl);

        map.on('draw:deleted', function (e) {
          Object.keys(e.layers._layers)
            .forEach(element => {
              var
                polyid = parseInt(element),
                delbox = boxData.find(function (box) {
                  return box.polyid == polyid;
                }),
                delindex = handler.delete.box(delbox);
            });
          selectedBox = boxData[0];
          selectedPoly = boxLayer.getLayer(selectedBox.polyid);
        });
        map.on('draw:deletestart', async function (event) {
          mapState = 'deleting';
        });
        map.on('draw:deletestop', async function (event) {
          mapState = null;
        });
        map.on('draw:drawstart', async function (event) {
          mapState = 'editing';
        });
        map.on('draw:drawstop', async function (event) {
          mapState = null;
        });
        map.on(L.Draw.Event.CREATED, async function (event) {
          if (event.layerType === 'rectangle') {
            await handler.create.rectangle(event.layer);
          } else if (event.layerType === 'polyline') {
            await handler.create.polyline(event.layer);
          }
          handler.focusBoxID(selectedPoly._leaflet_id);
        });
      },
      rectangle: function (layer) {
        layer.on('edit', handler.editRectangle);
        layer.on('click', handler.selectRectangle);
        handler.style.setActive(layer);
        boxLayer.addLayer(layer);
        var
          polyid = boxLayer.getLayerId(layer),
          newBox = new Box({
            polyid: polyid,
            text: '',
            x1: Math.round(layer._latlngs[0][0].lng),
            y1: Math.round(layer._latlngs[0][0].lat),
            x2: Math.round(layer._latlngs[0][2].lng),
            y2: Math.round(layer._latlngs[0][2].lat)
          }),
          idx = 0;
        if (selectedBox) {
          idx = boxData.findIndex(function (x) {
            return x.equals(selectedBox);
          });
        }
        boxData.splice(idx + 1, 0, newBox);
        handler.sortAllBoxes();
        map.addLayer(boxLayer);
        handler.focusBoxID(polyid);
      },
      polyline: async function (poly) {
        handler.set.loadingState({ main: true, buttons: true });
        var
          polyBounds = poly.getBounds(),
          newSelectedPoly = null,
          newBoxes = [],
          deleteBoxes = [];
        for (var i = 0; i < boxData.length; i++) {
          var
            box = boxData[i],
            boxBounds = L.latLngBounds([box.y1, box.x1], [box.y2, box.x2]),
            intersection = boxBounds.intersects(polyBounds);
          if (intersection) {
            deleteBoxes.push(box);
            var boxes = handler.cutBoxByPoly(box, poly);
            if (selectedPoly._leaflet_id == box.polyid) {
              newSelectedPoly = boxes[0];
            }
            if (boxes.length > 0) {
              newBoxes = newBoxes.concat(boxes);
            }
          }
        }
        deleteBoxes
          .forEach(function (box) {
            var layer = boxLayer.getLayer(box.polyid);
            boxLayer.removeLayer(layer);
            handler.delete.box(box);
          });

        newBoxes = newBoxes.map(box => new Box(box));

        newBoxes
          .forEach(function (newBox) {
            var newPoly = L.rectangle([[newBox.y1, newBox.x1], [newBox.y2, newBox.x2]]);
            newPoly.on('edit', handler.editRectangle);
            newPoly.on('click', handler.selectRectangle);
            boxLayer.addLayer(newPoly);
            var polyid = boxLayer.getLayerId(newPoly);
            newBox.polyid = polyid;
            boxData.push(newBox);
          });

        handler.sortAllBoxes();
        if (newSelectedPoly) {
          selectedBox = boxData.find(x =>
            x.x1 == newSelectedPoly.x1 &&
            x.x2 == newSelectedPoly.x2 &&
            x.y1 == newSelectedPoly.y1 &&
            x.y2 == newSelectedPoly.y2
          );
          selectedPoly = boxLayer.getLayer(selectedBox.polyid);
          handler.focusBoxID(selectedBox.polyid);
        }
        handler.set.loadingState({ main: false, buttons: false });
      },
    },
    ocr: {
      detect: async function (boxList = []) {
        if (boxList.length == 0) {
          return await worker.recognize(image._image);
        }
        boxLayer.getLayers().forEach(shape => {
          handler.style.remove(shape);
        });
        for (var box of boxList) {
          var layer = boxLayer.getLayer(box.polyid);
          handler.map.disableEditBox(layer);
          handler.style.setProcessing(layer);
          const message = {
            type: 'regeneratingTextData',
            value: boxList.findIndex(x => x.polyid == box.polyid),
            total: boxList.length,
          };
          var
            rectangle = {
              left: box.x1,
              top: imageHeight - box.y2,
              width: box.x2 - box.x1,
              height: box.y2 - box.y1,
            },
            result = await worker.recognize(image._image, { rectangle });
          box.text = result.data.text;//.replace(/(\r\n|\n|\r)/gm, '');
          box.committed = true;
          // box.visited = false;
          // if (selectedPoly._leaflet_id == layer._leaflet_id) {
          //   handler.style.setActive(layer);
          // } else {
          handler.style.remove(layer);
          // }
        };
        return boxList;
      },
    },
    formatDate: function (date) {
      var options = { month: 'long', day: 'numeric', year: 'numeric' };
      var dateString = date.toLocaleDateString('en-US', options);
      // dateString = dateString.replace(/(\d+)(st|nd|rd|th)/, '$1');
      const day = date.getDate();
      let daySuffix;

      if (day === 1 || day === 21 || day === 31) {
        daySuffix = "st";
      } else if (day === 2 || day === 22) {
        daySuffix = "nd";
      } else if (day === 3 || day === 23) {
        daySuffix = "rd";
      } else {
        daySuffix = "th";
      }

      const formattedDate = dateString.replace(/\d+/, day + daySuffix);
      return formattedDate;
    },
    applyTransliterationRules: function (text, rules) {
      for (let rule of rules) {
        var
          originalCharacter = rule["original-character"],
          conditions = rule["conditions"];

        for (let condition of conditions) {
          var
            context = condition["context"],
            output = condition["output"],
            pattern = new RegExp(
              `(${context})(${originalCharacter})(${context})`
            ),
            subst = `$1${output}$3`;

          text = text.normalize("NFKD").replace(/[\u0300-\u036f\ua67c]/g, "");

          // if regex context finds matches in text
          if (text.search(context) !== -1) {
            // apply substitution
            text = text.replace(new RegExp(context, "g"), subst);
            text = text.replace(new RegExp(context, "g"), subst);
            text = text.replace(new RegExp(context, "g"), subst);
            text = text.replace(new RegExp(context, "g"), subst);
          }
        }
      }
      return text;
    },
    resetAppSettings: async function () {
      var
        response = await handler.askUser({
          title: 'Reset App',
          message: 'The app will reset it\'s settings and reload. Are you sure you want to continue?',
          type: 'replacingTextWarning',
          actions: [{
            text: 'Cancel',
            class: 'cancel',
          }, {
            text: 'Reset',
            class: 'red ok',
          }]
        });
      if (response) {
        handler.clearLocalStorage();
      }
    },
    askUser: async function (object) {
      if (!object.message) return false;
      if (object.actions == []) {
        object.actions = [{
          confirmText: 'Yes',
          confirmTextClass: 'green positive',
        }, {
          denyText: 'No',
          denyTextClass: 'red negative',
        }];
      }
      return new Promise((resolve, reject) => {
        $.modal({
          inverted: false,
          title: object.title,
          blurring: true,
          closeIcon: true,
          autofocus: true,
          restoreFocus: true,
          onApprove: function () {
            resolve(true);
          },
          onDeny: function () {
            resolve(false);
          },
          onHide: function () {
            resolve(false);
          },
          content: object.message,
          actions: object.actions,
        }).modal('show');
      });
    },
    clearLocalStorage: function () {
      localStorage.removeItem(appSettings.localStorageKey);
      location.reload();
    },
    getBoxFileType: function (content) {
      if (content == '') boxFileType = BoxFileType.WORDSTR;
      var
        firstLine = content.startsWith('WordStr '),
        secondLine = content.split('\n')[1].startsWith('\t');
      if (firstLine && secondLine) {
        boxFileType = BoxFileType.WORDSTR;
      } else {
        boxFileType = BoxFileType.CHAR_OR_LINE;
      }
    },
    getBoxContent: function (previous = false) {
      if (typeof selectedBox === 'undefined') return boxData[0];
      var
        range = boxData.length,
        el = boxData.findIndex(el => el.polyid == selectedBox.polyid);
      if (previous) return boxData[(el + range - 1) % range];
      return boxData[(el + 1) % range];
    },
    getNextBoxContentAndFill: function () {
      var
        isUpdated = handler.submitText(),
        box = handler.getBoxContent();
      handler.focusBoxID(box.polyid, { isUpdated });
    },
    getPreviousBoxContentAndFill: function () {
      var
        isUpdated = handler.submitText(),
        box = handler.getBoxContent(previous = true);
      handler.focusBoxID(box.polyid, { isUpdated });

    },
    download: {
      file: async function (type, event) {
        event.preventDefault() && event.stopPropagation();
        if ($output.text().length == 0) {
          handler.notifyUser({
            message: 'There is nothing to download!',
            type: 'warning',
          });
          return false;
        }
        handler.sortAllBoxes();
        for (var box of boxData) {
          box.text = box.text.replace(/(\r\n|\n|\r)/gm, '');
        }
        var
          content = '',
          fileExtension = '';
        if (type == 'txt') {
          content = await $output.text();
          fileExtension = appSettings.interface.displayText == 'rts' ? 'transliterated.txt' : 'ocr.txt';
        }
        downloadAnchor = document.createElement('a');
        downloadAnchor.href = 'data:application/text;charset=utf-8,' + encodeURIComponent(content);
        downloadAnchor.download = imageFileName + '.' + fileExtension;
        downloadAnchor.target = '_blank';
        downloadAnchor.style.display = 'none';

        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        document.body.removeChild(downloadAnchor);
        handler.notifyUser({
          message: 'Downloaded file ' + imageFileName + '.' + fileExtension,
          type: 'success',
        });
        boxDataInfo.setDirty(false);
      },
    },
    focusBoxID: function (id, options = { isUpdated: false, zoom: true }) {
      if (options.isUpdated == undefined) options.isUpdated = false;
      if (options.zoom == undefined) options.zoom = true;
      handler.style.remove(selectedPoly);
      handler.map.disableEditBox(selectedBox);
      var shape = boxLayer.getLayer(id);
      if (options.zoom) handler.map.focusShape(shape, options.isUpdated);
      selectedBox = boxData.find(x => x.polyid == shape._leaflet_id);
      handler.style.setActive(shape);
    },
    style: {
      setProcessing: function (poly) {
        if (poly) {
          poly.setStyle(boxState.boxProcessing);
        }
      },
      setActive: function (poly) {
        if (poly) {
          poly.setStyle(boxState.boxActive);
        }
      },
      setCommitted: function (poly) {
        if (poly) {
          poly.setStyle(boxState.boxComitted);
        }
      },
      remove: function (poly, isUpdated = false) {
        if (poly) {
          if (boxData.find(x => x.polyid == poly._leaflet_id).committed) {
            poly.setStyle(boxState.boxComitted);
          } else {
            poly.setStyle(boxState.boxInactive);
          }
        }
      },
    },
    delete: {
      box: function (box) {
        var
          boxIndex = boxData.findIndex(function (object) {
            return object.equals(box);
          });
        if (boxIndex > -1) {
          boxData.splice(boxIndex, 1);
        }
        var
          newIndex = recognizedLinesOfText.findIndex(function (object) {
            object = object.bbox;
            var newBox = new Box({
              text: '',
              y1: imageHeight - object.y1, // bottom
              y2: imageHeight - newBox.y0, // top
              x1: object.x0, // right
              x2: object.x1 // left
            });
            return newBox.x1 == box.x1 && newBox.y1 == box.y1 && newBox.x2 == box.x2 && newBox.y2 == box.y2;
          });
        if (newIndex > -1) {
          recognizedLinesOfText.splice(newIndex, 1);
        }
        return boxIndex;
      },
      expiredNotifications: function () {
        const currentDate = new Date();

        $('.updateNotification').each(function () {
          const
            releaseDate = new Date($(this).attr('data-release-date')),
            removeDays = parseInt($(this).attr('data-expire-notification')),
            timeDifference = currentDate - releaseDate,
            daysDifference = timeDifference / (1000 * 60 * 60 * 24);

          if (daysDifference >= removeDays) {
            $(this).remove();
            console.info(`Notification removed: ${$(this).attr('data-release-date')}`);
          }
        });
      },
    },
    map: {
      disableEditBox: function (shape) {
        if (selectedPoly && shape != selectedPoly) {
          selectedPoly.editing.disable();
        }
      },
      enableEditBox: function (shape) {
        selectedPoly = shape;
        shape.editing.enable();
      },
      getMapPosition: function () {
        return map.getBounds();
      },
      fitImage: function () {
        map.flyToBounds(image.getBounds(), {
          duration: .25,
          easeLinearity: .25,
          animate: true,
        });
      },
      fitBounds: function (bounds) {
        map.flyToBounds(bounds, {
          maxZoom: maxZoom,
          animate: true,
          paddingBottomLeft: mapPaddingBottomLeft,
          duration: .25,
          easeLinearity: .25,
        });
      },
      focusShape: function (box, isUpdated = false) {
        handler.style.remove(selectedPoly, isUpdated);
        handler.map.disableEditBox(selectedPoly);
        map.flyToBounds(box.getBounds(), {
          maxZoom: maxZoom,
          animate: true,
          paddingBottomLeft: mapPaddingBottomLeft,
          duration: .25,
          easeLinearity: .25,
        });
        selectedPoly = box;
        handler.style.setActive(box);
      },
    },
    generate: {
      initialBoxes: async function (includeSuggestions = true) {
        $redetectAllBoxesButton.addClass('disabled double loading');

        handler.set.loadingState({ buttons: true, main: true });
        handler.map.fitImage();
        boxLayer.clearLayers();
        boxData = [];
        try {
          var
            results = await handler.ocr.detect(),
            textLines = results.data.lines;
          ocrOutput = results.data.text;

          await handler.pasteOutput();

          if (textLines.length == 0) {
            handler.set.loadingState({ buttons: false, main: false });
            return false;
          }
          handler.set.loadingState({ buttons: false, main: false });
        } catch (error) {
          console.log(error);
          handler.set.loadingState({ buttons: false, main: false });
        }

        $redetectAllBoxesButton.removeClass('disabled double loading');
      },
      textSuggestion: async function () {
        $regenerateTextSuggestionForSelectedBoxButton.addClass('disabled double loading');
        if (boxLayer.getLayers().length > 0) {
          var
            results = await handler.ocr.detect([selectedBox]),
            element = boxData.findIndex(el => el.polyid == selectedBox.polyid);
          ocrOutput = results[0].text;
          await handler.pasteOutput();
          boxData[element].text = results.length > 0 ? results[0].text : '';
        }
        $regenerateTextSuggestionForSelectedBoxButton.removeClass('disabled double loading');
      },
      textSuggestions: async function () {
        $regenerateTextSuggestionsButton.addClass('disabled double loading');
        // var mapPosition = handler.map.getMapPosition();
        // handler.map.fitImage();

        if (boxLayer.getLayers().length > 0) {
          var results = await handler.ocr.detect(boxData);
          ocrOutput = results.map(x => x.text).join('\n');
          await handler.pasteOutput();
        }
        // handler.map.fitBounds(mapPosition);
        handler.set.loadingState({ buttons: false, main: false });
        $regenerateTextSuggestionsButton.removeClass('disabled double loading');
      },
    },
    editRectangle: async function (event) {
      var
        layer = event.target,
        box = boxData.find(x => x.polyid == layer._leaflet_id),
        newBox = new Box({
          text: box.text,
          x1: Math.round(layer._latlngs[0][0].lng),
          y1: Math.round(layer._latlngs[0][0].lat),
          x2: Math.round(layer._latlngs[0][2].lng),
          y2: Math.round(layer._latlngs[0][2].lat),
        });
      // await handler.update.boxData(layer._leaflet_id, newBox);
      // handler.update.form(newBox);
      handler.sortAllBoxes();
    },
    selectRectangle: function (event) {
      if (event.target.editing.enabled() || mapState == 'deleting') {
        return;
      }
      var
        shape = event.target;
      // handler.style.remove(selectedPoly);
      handler.map.disableEditBox(selectedPoly);
      handler.focusBoxID(shape._leaflet_id);
      handler.map.enableEditBox(shape);
      handler.sortAllBoxes();
    },
    clearOutput: function () {
      $output.text('');
    },
    pasteOutput: async function () {
      if (appSettings.interface.displayText == 'rts') {
        if (transliteratedOutput == "" || transliteratedOutput == undefined) {
          $toggleOutputScriptButton.addClass('disabled double loading');
          await handler.process.text(ocrOutput, (transliteratedText) => {
            $output.text(transliteratedText);
          });
        }
        $output.text(transliteratedOutput);
        $toggleOutputScriptButton.removeClass('disabled double loading');
      } else {
        $output.text(ocrOutput);
      }
    },
    sortAllBoxes: function () {
      boxData.sort(Box.compare);
    },
    notifyUser: function (object) {
      if (object.title == undefined) {
        object.title = object.type.charAt(0).toUpperCase() + object.type.slice(1);
      }
      if (object.time == undefined) {
        object.time = 'auto';
      }
      $.toast({
        title: object.title,
        class: object.type,
        displayTime: object.time,
        showProgress: 'top',
        position: 'top right',
        classProgress: object.color,
        message: object.message,
        minDisplayTime: 3000,
        actions: object.actions ? object.actions : false,
      });
    },
    cutBoxByPoly: function (box, poly) {
      var
        polyFeature = turf.lineString(poly),
        boxFeature = turf.bboxPolygon([box.x1, box.y1, box.x2, box.y2]),
        splitLines = [];

      for (var i = 0; i < poly._latlngs.length - 1; i++) {
        var
          segmentPoints = [[poly._latlngs[i].lng, poly._latlngs[i].lat], [poly._latlngs[i + 1].lng, poly._latlngs[i + 1].lat]],
          j = i + 1;
        while (turf.booleanPointInPolygon([poly._latlngs[j].lng, poly._latlngs[j].lat], boxFeature) && j < poly._latlngs.length - 1) {
          j++;
          segmentPoints.push([poly._latlngs[j].lng, poly._latlngs[j].lat]);
        }
        var segmentFeature = turf.lineString(segmentPoints);
        splitLines.push(segmentFeature);
        i = j - 1;
      }

      var intersectingLines = [];
      splitLines.forEach(function (line) {
        if (turf.booleanIntersects(line, boxFeature)) {
          intersectingLines.push(line);
        }
      });

      var boxGaps = [];
      intersectingLines.forEach(function (line) {
        boxGaps.push(turf.envelope(line));
      });

      var
        newBoxes = [],
        newEdges = [];
      newEdges.push(box.x1);
      boxGaps.forEach(function (gap) {
        newEdges.push(gap.geometry.coordinates[0][0][0]);
        newEdges.push(gap.geometry.coordinates[0][2][0]);
      });
      newEdges.push(box.x2);

      newEdges.sort(function (a, b) { return a - b });

      for (var i = 0; i < newEdges.length - 1; i += 2) {
        var newBox = {
          x1: newEdges[i],
          y1: box.y1,
          x2: newEdges[i + 1],
          y2: box.y2
        };
        newBoxes.push(newBox);
      }

      newBoxes.forEach(function (element) {
        element.x1 = Math.round(element.x1);
        element.y1 = Math.round(element.y1);
        element.x2 = Math.round(element.x2);
        element.y2 = Math.round(element.y2);
      });

      return newBoxes;
    },
    close: {
      settingsModal: function () {
        $settingsModal.modal('hide');
      },
      popups: function () {
        $popups.popup('hide');
      },
    },
    open: {
      settingsModal: function (location = '') {
        // if location is an event and not a string
        if (!(typeof location === 'string')) {
          location = '';
        }
        handler.close.popups();
        $settingsModal.modal('show');
        if (location) {
          $settingsMenuItems.removeClass('active');
          $settingsMenuPaneTabs.removeClass('active');
          $settingsMenuItems.filter('[data-tab="' + location + '"]').addClass('active');
          $settingsMenuPaneTabs.filter('[data-tab="' + location + '"]').addClass('active');
        }
        balanceText.updateWatched();
      },

    },
    copyToClipboard: function () {
      $copyToClipboardButton.addClass('double loading disabled');
      var output = document.getElementById('text-output').value;
      if (output.length > 0) {
        navigator.clipboard.writeText(output).then(function () {
          handler.notifyUser({ message: 'Copied ' + output.length + ' characters.', type: 'info' });
        }, function (err) {
          handler.notifyUser({ message: 'Could not copy output. ' + err, type: 'info' });
        });
      } else {
        handler.notifyUser({ message: 'No text to copy.', type: 'info' });
      }
      setTimeout(() => {
        $copyToClipboardButton.removeClass('double loading disabled');
      }, 100);
    },
    toggleOutputScript: async function (e) {
      scripts = ['transliteration', 'rts'];
      // if 'transliteration' then switch to 'rts' and vice versa
      appSettings.interface.displayText = scripts.find(v => v !== appSettings.interface.displayText);
      handler.update.localStorage();
      await handler.pasteOutput();
      if (appSettings.interface.displayText == 'rts') {
        $toggleOutputScriptButton.find('span').text('Transliteration');
        // $toggleOutputScriptButton.setAttribute('data-tooltip', 'Switch to recognized RTS text');
      } else {
        $toggleOutputScriptButton.find('span').text('RTS');
        // $toggleOutputScriptButton.setAttribute('data-tooltip', 'Switch to transliterated text');
      }
    },
    receiveDroppedFiles: async function (files) {
      if (files.length > 1) {
        handler.notifyUser({
          title: 'Too many files',
          message: 'Upload a single image.',
          type: 'error',
        });
        return;
      }
      if (files.length < 1) {
        notifyUser({
          title: 'No files',
          message: 'You need to drop at least one file.',
          type: 'error',
        });
        return;
      }
      files.forEach(function (file) {
        if (file.type.includes('image')) {
          imageFile = file;
        }
      });

      if (!imageFile && !imageFileInfo.isProcessed()) {
        handler.notifyUser({
          title: 'No image file',
          message: 'You need one image file.',
          type: 'error',
        });
        return;
      }
      if (imageFile) {
        await handler.load.imageFile(imageFile);
      }
      $dropzone[0].dropzone.removeAllFiles();
    },
    bindInputs: function () {
      $imageFileInput.on('change', handler.load.imageFile);
      $checkboxes.checkbox();
    },
    bindButtons: function () {
      $copyToClipboardButton.on('click', handler.copyToClipboard);
      $toggleOutputScriptButton.on('click', handler.toggleOutputScript);
      $regenerateTextSuggestionForSelectedBoxButton.on('click', handler.generate.textSuggestion);
      $redetectAllBoxesButton.on('click', handler.generate.initialBoxes);
      $regenerateTextSuggestionsButton.on('click', handler.generate.textSuggestions);
      $settingsButton.on('click', handler.open.settingsModal);
      $settingsButtonForHelpPane.on('click', handler.open.settingsModal.bind(handler.open, 'help-section'));
      $resetButton.on('click', handler.resetAppSettings);
      $useSampleImageButton.on('click', handler.load.sampleImageAndBox);
      $saveOutputToDisk.on('click', handler.download.file.bind(handler.download, 'txt'));
    },
    addBehaviors: function () {
      $('.guideMessage').dimmer('show');
    },
    initialize: async function () {
      handler.bindInputs();
      handler.bindButtons();
      handler.addBehaviors();
      $imageFileInput.prop('disabled', false);
      handler.load.dropzone();
      handler.load.popups();
      handler.load.sliders();
      handler.load.settings();
      handler.load.eventListeners();

      handler.delete.expiredNotifications();
      balanceText($balancedText, { watch: true });
      handler.hideSplashScreen();
    },
    hideSplashScreen: function () {
      $body[0].style.transition = "opacity 0.5s ease-in-out";
      $body[0].style.opacity = "1";
    },
  };
  app.handler = handler;

  // Start the Magic
  await app.handler.initialize();
  // app.handler.open.settingsModal('interface-settings');
};

// attach ready event
$(document).ready(app.ready);