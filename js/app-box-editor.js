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
app.ready = function () {

  // selector cache
  var
    $document = $(document),
    $window = $(window),
    $html = $('html'),
    $highlighterLabels = $('#highlighters-labels'),
    $invisiblesToggleButton = $('#invisiblesToggle.ui.button'),
    $redetectAllBoxesButton = $('#redetectAllBoxes'),
    $regenerateTextSuggestionsButton = $('#regenerateTextSuggestions'),
    $regenerateTextSuggestionForSelectedBoxButton = $('#regenerateTextSuggestionForSelectedBox'),
    $colorizedOutputForms = $('.colorized-output-form'),
    $colorizedInputFields = $('.colorized-input-field'),
    $colorizedOutputFields = $('.colorized-output-field'),
    $groundTruthInputField = $('#formtxt'),
    $x1Field = $('#x1'),
    $x2Field = $('#x2'),
    $y1Field = $('#y1'),
    $y2Field = $('#y2'),
    $groundTruthInputFieldContainer = $('#myInputContainer'),
    $fields = $($('input, .field'), $groundTruthInputFieldContainer),
    $buttons = $('button, .ui.button'),
    $coordinateFields = $('.box-coordinates'),
    $groundTruthForm = $('#updateTxt'),
    $settingsModal = $('.ui.settings.modal'),
    $settingsModalStatus = $('#settingsModalStatus'),
    $map = $('#mapid'),
    $boxFileInput = $('#boxFile'),
    $imageFileInput = $('#imageFile'),
    $downloadBoxFileButton = $('#downloadBoxFileButton'),
    $downloadGroundTruthFileButton = $('#downloadGroundTruthButton'),
    $previousBoxButton = $('#previousBB'),
    $nextBoxButton = $('#nextBB'),
    $groundTruthColorizedOutput = $('#myInputBackground'),
    $previewColorizedOutput = $('#myPreviewBackground'),
    $taggingSegment = $('#taggingSegment'),
    $positionSlider = $('.ui.slider'),
    $progressSlider = $('#progressIndicator'),
    $progressLabel = $progressSlider.find('.label'),
    $popups = $('.popup'),
    $settingsButton = $('#settingsButton'),
    $settingsButtonForHelpPane = $('.helpSettingsPopup'),
    $settingsMenuNav = $('#settingsMenu'),
    $settingsMenuItems = $settingsMenuNav.find('.item'),
    $settingsMenuPane = $('#mainSettingsPane'),
    $settingsMenuPaneTabs = $settingsMenuPane.find('.ui.tab'),
    $highlighterTextPreview = $('#previewText'),
    $useSampleImageButton = $('#useSampleImage'),
    $useSamplePopup = $('.ui.useSampleImage.popup'),
    $resetButton = $('#resetAppSettingsAndCookies'),
    $addNewHighligherButton = $('#addNewHighlighterPattern'),
    $dropzone = $('div.my-dropzone'),
    $textHighlightingEnabledCheckbox = $(`input[name='highlighter.textHighlighting.textHighlightingEnabled']`),
    $checkboxes = $('.ui.checkbox'),
    $highlighterTableBody = $('.ui.celled.table tbody'),
    $highlighterTableRows = $highlighterTableBody.find('tr'),
    $highlighterTableContainer = $('#highlighterTableContainer'),

    // variables
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
    mapPaddingBottomRight = [40, 0],
    imageFileName,
    imageFileNameForButton,
    boxFileName,
    boxFileNameForButton,
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
    lineDataInfo = {
      dirty: false,
      isDirty: function () {
        return this.dirty;
      },
      setDirty: function (value = true) {
        this.dirty = value;
      }
    },
    unicodeData,
    imageFile,
    boxFile,
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
    currentSliderPosition = -1,
    invalidPatterns = false,
    identicalPatternNames = false,
    suppressLogMessages = {
      'recognizing text': false,
    },

    appSettings = {
      interface: {
        appearance: 'match-device',
        toolbarActions: {
          detectAllLines: true,
          detectSelectedBox: true,
          detectAllBoxes: true,
          invisiblesToggle: true,
        },
        imageView: 'medium',
        workflow: {
          progressIndicator: true,
          positionSlider: true,
          formCoordinateFields: true,
        },
        showInvisibles: false,
      },
      behavior: {
        onImageLoad: {
          detectAllLines: false,
          includeTextForDetectedLines: false,
        },
        alerting: {
          enableWarrningMessagesForDifferentFileNames: true,
          enableWarrningMessagesForUncommittedChanges: true,
        },
        convenience: {
          autoDownloadBoxFileOnAllLinesComitted: false,
          autoDownloadGroundTruthFileOnAllLinesComitted: false,
        },
      },
      highlighter: {
        textHighlighting: {
          textHighlightingEnabled: true,
          highlightsPatterns: [],
        },
      }
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
      }
    },

    // alias
    handler
    ;

  // event handler
  handler = {
    bindColorizerOnInput: function () {
      $colorizedOutputForms.each(function () {
        $(this).find('input').bind('input', handler.update.colorizedBackground);
      });
    },
    colorizeText: async function (text) {
      if (text == '') return '&nbsp;';
      text = text.normalize('NFD');
      var
        colorizedText = '',
        currentScript = null,
        currentSpan = '',
        spanClass = '',
        charSpace = appSettings.interface.showInvisibles ? '·' : '&nbsp;';
      const highlights = Object.assign(
        handler.getHighlighters(),
        {
          space: {
            name: 'Space',
            color: 'space',
            enabled: true,
            pattern: '\\s',
          }
        }
      );
      for (var i = 0; i < text.length; i++) {
        var
          isCapital = false,
          char = text.charAt(i),
          charName = handler.getUnicodeInfo(char)[0].name,
          foundHighlight = null;
        if (charName.includes('COMBINING')) {
          currentSpan += char;
          continue;
        }
        if (char != char.toLowerCase()) {
          isCapital = true;
        }

        const keys = Object.keys(highlights).reverse();
        for (const key of keys) {
          const highlight = highlights[key];
          if (new RegExp(highlight.pattern).test(char)) {
            foundHighlight = highlight;
            break;
          }
        }

        if (foundHighlight) {
          spanClass = foundHighlight.color.toLowerCase() +
            (isCapital ? ' capital' : '') +
            ' text-highlighter';

          if (currentScript != spanClass) {
            if (currentSpan != '') {
              colorizedText += '</span>' + currentSpan;
            }
            if (spanClass.includes('space')) {
              currentSpan = '<span class="' + spanClass + '">' + charSpace;
            } else {
              currentSpan = '<span class="' + spanClass + '">' + char;
            }
          } else {
            if (currentScript.includes('space')) {
              if (!currentSpan.includes('multiple')) {
                currentSpan = currentSpan.reaplace('space', 'space multiple');
              }
              currentSpan += charSpace;
            } else {
              currentSpan += char;
            }
          }
        } else {
          spanClass = 'other';
          if (currentScript != spanClass) {
            if (currentSpan !== '') {
              if (currentScript.includes('space') &&
                !currentScript.includes('multiple')) {
                currentSpan = currentSpan.replace('space', 'space multiple');
              }
              colorizedText += '</span>' + currentSpan;
            }
            currentSpan = '<span class="' + spanClass + '">' + char;
            currentScript = spanClass;
          } else {
            currentSpan += char;
          }
        }
      }
      colorizedText += '</span>' + currentSpan;
      return colorizedText;
    },
    getHighlighters: function () {
      var patterns = {};
      if (appSettings.highlighter.textHighlighting.textHighlightingEnabled) {
        if (appSettings.highlighter.textHighlighting.highlightsPatterns.length == 0) {
          handler.saveHighlightsToSettings();
        }
        for (entry of appSettings.highlighter.textHighlighting.highlightsPatterns) {
          if (entry.enabled) {
            patterns[entry.name] = entry;
          }
        }
      }
      return patterns;
    },
    getUnicodeInfo: function (string) {
      var unicodeInfo = [];
      string = string.normalize('NFD');

      for (var i = 0; i < string.length; i++) {
        var
          char = string.charAt(i),
          code = char.charCodeAt(0),
          hex = code.toString(16).toUpperCase(),
          unicode = '0000'.substring(hex.length) + hex,
          result = handler.getUnicodeData(unicode);
        if (unicodeInfo.find(function (x) {
          return x['code'] == result.code;
        }) == undefined) {
          unicodeInfo.push(result);
        }
      }
      return unicodeInfo;
    },
    getUnicodeData: function (unicode) {
      // TODO: declare unicodeData and other variables elsewhere
      var result = unicodeData.find(function (x) {
        return x['code'] == unicode;
      });
      result.char = String.fromCharCode(parseInt(unicode, 16));
      return result;
    },
    saveHighlightsToSettings: function () {
      if (appSettings.highlighter.textHighlighting.textHighlightingEnabled) {
        var
          patterns = [],
          errorMessages = [];
        $highlighterTableRows.each(function (index, elem) {
          handler.unhighlightCell(elem.querySelector('td:nth-child(4)'));
          var
            enabled = elem.querySelector('td:nth-child(1) .checkbox input').checked,
            name = elem.querySelector('td:nth-child(2)').innerText,
            color = elem.querySelector('td:nth-child(3) input[name=color]').value,
            pattern = elem.querySelector('td:nth-child(4)').innerText;
          try {
            var validation = new RegExp(pattern, 'i');
            patterns.push({
              enabled: enabled,
              name: name,
              color: color,
              pattern: pattern,
            });
          } catch (error) {
            handler.highlightCell(elem.querySelector('td:nth-child(4)'));
            errorMessages.push({ name, enabled, error });
          }
        });
        invalidPatterns = false;
        if (errorMessages.length > 0) {
          console.error('Regex pattern errors:');
          errorMessages.forEach(function (object) {
            console.error(object.errorMessage);
            if (object.enabled) {
              invalidPatterns = true;
            }
          });
        }
        identicalPatternNames = false;
        patternNames = patterns.map(function (pattern) {
          return pattern.name;
        });
        patternNamesSet = [...new Set(patternNames)];
        if (patternNames.length != patternNamesSet.length) {
          identicalPatternNames = true;
        }
        appSettings.highlighter.textHighlighting.highlightsPatterns = patterns;
      }
      if (appSettings.highlighter.textHighlighting.highlightsPatterns.length > 0) {
        handler.update.colorizedBackground();
      }
      handler.update.patternLabels();
      handler.update.cookie();
    },
    highlightCell: function (elem) {
      $(elem).addClass('red colored');
    },
    unhighlightCell: function (elem) {
      $(elem).removeClass('red colored');
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
    askUser: async function (object) {
      if (!object.message) return false;
      if ((object.type === 'differentFileNameWarning' && !appSettings.behavior.alerting.enableWarrningMessagesForDifferentFileNames) ||
        (object.type === 'uncommittedChangesWarning' && !appSettings.behavior.alerting.enableWarrningMessagesForUncommittedChanges)) {
        return true;
      }
      handler.setKeyboardControl('prompt');
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
            handler.setKeyboardControl('form');
            resolve(false);
          },
          content: object.message,
          actions: object.actions,
        }).modal('show');
      });
    },
    clearCookies: function () {
      const cookies = Cookies.get();
      for (const cookie in cookies) {
        Cookies.remove(cookie);
      }
      location.reload();
    },
    resetAppSettingsAndCookies: async function () {
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
        handler.clearCookies();
      }
    },
    setKeyboardControl: function (context) {
      if (context == 'prompt') {
        $window.off('keydown');
      } else if (context == 'form') {
        $window.keydown(function (e) {
          if (e.keyCode == 13) {
            e.preventDefault();
            if (e.shiftKey) {
              handler.getPreviBoxContentAndFill();
            } else {
              handler.getNextBoxContentAndFill();
            }
            return false;
          }
        });
      }
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
    },
    create: {
      defaultHighlighterTable: async function () {
        const
          table = document.createElement('table'),
          thead = document.createElement('thead'),
          theadRow = document.createElement('tr'),
          headers = ['', 'Name', 'Color', 'Pattern', ''],
          tbody = document.createElement('tbody'),
          cookie = Cookies.get('appSettings');
        table.className = 'ui unstackable celled table';
        thead.appendChild(theadRow);
        for (const header of headers) {
          const th = document.createElement('th');
          th.className = header ? '' : 'collapsing';
          th.className = header === 'Color' ? 'four wide' : '';
          th.textContent = header;
          theadRow.appendChild(th);
        }

        var highlights = [];
        if (cookie) {
          const cookieSettings = JSON.parse(cookie);
          highlights = cookieSettings.highlighter.textHighlighting.highlightsPatterns;
          if (highlights.length > 0) {
            highlights.forEach(function (highlight) {
              const row = handler.create.highlighterRow(highlight.enabled, highlight.name, highlight.color, highlight.pattern);
              tbody.appendChild(row);
            });
          }
        }

        if (!cookie || highlights.length == 0) {
          const rows = [
            { enabled: true, name: 'Latin', color: 'blue', pattern: '[\\u0000-\\u007F\\u0080-\\u00FF]' },
            { enabled: true, name: 'Cyrillic', color: 'yellow', pattern: '[\\u0400-\\u04FF\\u0500-\\u052F\\u2DE0-\\u2DFF\\uA640-\\uA69F\\u1C80-\\u1CBF]' },
            { enabled: true, name: 'Digits', color: 'red', pattern: '[0-9]' },
          ];
          rows.forEach(function (row) {
            const rowElement = handler.create.highlighterRow(row.enabled, row.name, row.color, row.pattern);
            tbody.appendChild(rowElement);
          });
        }
        table.appendChild(thead);
        table.appendChild(tbody);

        $highlighterTableContainer[0].insertBefore(table, $highlighterTableContainer[0].firstChild);

        $highlighterTableBody = $('.ui.celled.table tbody');
        $highlighterTableRows = $highlighterTableBody.find('tr');

        return table;
      },
      infoPopupContent: function (objects) {
        var
          grid = document.createElement('div'),
          row = document.createElement('div'),
          leftColumn = document.createElement('div'),
          rightColumn = document.createElement('div'),
          leftHeader = document.createElement('b'),
          rightHeader = document.createElement('b');

        grid.classList.add('ui', 'compact', 'grid');
        row.classList.add('two', 'column', 'stretched', 'row');
        leftColumn.classList.add('twelve', 'wide', 'left', 'floated', 'column');
        rightColumn.classList.add('four', 'wide', 'right', 'floated', 'column', 'text', 'right', 'aligned');
        leftHeader.textContent = 'Name';
        rightHeader.textContent = 'Char';

        leftColumn.appendChild(leftHeader);
        rightColumn.appendChild(rightHeader);
        row.appendChild(leftColumn);
        row.appendChild(rightColumn);
        grid.appendChild(row);

        objects.forEach(function (object) {
          var
            newRow = document.createElement('div'),
            leftContent = document.createElement('div'),
            rightContent = document.createElement('div');
          newRow.classList.add('two', 'column', 'stretched', 'row');
          leftContent.classList.add('twelve', 'wide', 'left', 'floated', 'column');
          rightContent.classList.add('four', 'wide', 'right', 'floated', 'column', 'text', 'right', 'aligned');

          leftContent.textContent = object.name;
          rightContent.textContent = object.char;
          newRow.appendChild(leftContent);
          newRow.appendChild(rightContent);
          grid.appendChild(newRow);

        });
        return grid;
      },
      highlighterRow: function (enabled, name, color, pattern) {
        const
          row = document.createElement('tr'),
          checkboxCell = handler.create.checkboxCell(name),
          nameCell = handler.create.editableTextCell(name),
          colorCell = handler.create.colorCell(color),
          patternCell = handler.create.editableTextCell(pattern),
          actionCell = handler.create.actionsCell();
        row.appendChild(checkboxCell);
        row.appendChild(nameCell);
        row.appendChild(colorCell);
        row.appendChild(patternCell);
        row.appendChild(actionCell);

        return row;
      },
      checkboxCell: function (name) {
        const
          cell = document.createElement('td'),
          div = document.createElement('div'),
          input = document.createElement('input');
        cell.setAttribute('data-label', 'Enabled');
        div.className = 'ui fitted checkbox text-highlighter-checkbox';
        input.type = 'checkbox';
        input.name = name;
        input.checked = true;

        div.appendChild(input);
        $(div).checkbox({
          onChange: () => {
            handler.saveHighlightsToSettings();
          },
        });
        cell.appendChild(div);
        return cell;
      },
      editableTextCell: function (name) {
        const
          cell = document.createElement('td');
        cell.contentEditable = true;
        cell.innerText = name;
        $(cell).on('input', handler.saveHighlightsToSettings);
        return cell;
      },
      colorCell: function (color) {
        const
          cell = document.createElement('td'),
          dropdownDiv = document.createElement('div'),
          hiddenInput = document.createElement('input'),
          dropdownIcon = document.createElement('i'),
          defaultText = document.createElement('div'),
          menuDiv = document.createElement('div'),
          colors = ['red', 'orange', 'yellow', 'olive', 'green', 'teal', 'blue', 'violet', 'purple', 'pink', 'brown', 'grey'];
        cell.className = 'collapsing';
        cell.setAttribute('data-label', 'Color');
        dropdownDiv.className = 'ui fluid search selection dropdown';
        hiddenInput.type = 'hidden';
        hiddenInput.name = 'color';
        dropdownIcon.className = 'dropdown icon';
        defaultText.className = 'default text';
        defaultText.textContent = 'Color...';
        menuDiv.className = 'menu';
        colors.forEach(function (color) {
          const
            itemDiv = document.createElement('div'),
            colorIcon = document.createElement('i'),
            colorText = document.createElement('span');
          itemDiv.className = 'item';
          itemDiv.setAttribute('data-value', color);
          colorIcon.className = `ui ${color} small empty circular label icon link text-highlighter`;
          colorText.textContent = color.charAt(0).toUpperCase() + color.slice(1);
          itemDiv.appendChild(colorIcon);
          itemDiv.appendChild(colorText);
          menuDiv.appendChild(itemDiv);
        });
        dropdownDiv.appendChild(hiddenInput);
        dropdownDiv.appendChild(dropdownIcon);
        dropdownDiv.appendChild(defaultText);
        dropdownDiv.appendChild(menuDiv);

        $(dropdownDiv).dropdown({
          onChange: handler.saveHighlightsToSettings,
        });

        if (color) {
          $(dropdownDiv).dropdown('set selected', color, true);
        } else {
          $(dropdownDiv).dropdown('set selected', colors[Math.floor(Math.random() * colors.length)], true);
        }
        cell.appendChild(dropdownDiv);

        return cell;
      },
      actionsCell: function () {
        const
          actionCell = document.createElement('td'),
          deleteButton = document.createElement('i');
        actionCell.className = 'single line';
        actionCell.setAttribute('data-label', 'Edit');
        deleteButton.className = 'large red minus circle link icon';
        $(deleteButton).on('click', function () {
          $(this).parent().parent().remove();
          $highlighterTableBody = $('.ui.celled.table tbody');
          $highlighterTableRows = $highlighterTableBody.find('tr');
          handler.saveHighlightsToSettings();
        });
        actionCell.appendChild(deleteButton);
        return actionCell;
      },
      map: function (name) {
        map = new L.map(name, {
          crs: L.CRS.Simple,
          minZoom: -1,
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
          zoomControl = new L.Control.Zoom({ position: 'topright' }),
          drawControl = new L.Control.Draw({
            draw: {
              polygon: false,
              marker: false,
              circle: false,
              polyline: true,
              rectangle: true,
              circlemarker: false
            },
            position: 'topright',
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
          handler.update.progressBar({ type: 'tagging' });
        });
        map.on('draw:deletestart', async function (event) {
          mapState = 'deleting';
        });
        map.on('draw:deletestop', async function (event) {
          mapState = null;
          handler.update.slider({ max: boxData.length });
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
        handler.init.slider();
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
            handler.style.remove(newPoly);
            boxLayer.addLayer(newPoly);
            var polyid = boxLayer.getLayerId(newPoly);
            newBox.polyid = polyid;
            boxData.push(newBox);
          });

        await handler.ocr.detect(newBoxes);
        handler.sortAllBoxes();
        handler.update.progressBar({ type: 'tagging' });
        handler.update.slider({ max: boxData.length });
        if (newSelectedPoly) {
          handler.focusBoxID(boxData.find(x =>
            x.x1 == newSelectedPoly.x1 &&
            x.x2 == newSelectedPoly.x2 &&
            x.y1 == newSelectedPoly.y1 &&
            x.y2 == newSelectedPoly.y2
          ).polyid);
        }
        handler.set.loadingState({ main: false, buttons: false });
      },
    },
    addNewHighlighterPattern: function () {
      const tableBody = $highlighterTableBody[0];
      const row = handler.create.highlighterRow(true, 'New Highlighter', false, '.');
      tableBody.append(row);
      // update selectors
      $highlighterTableBody = $('.ui.celled.table tbody');
      $highlighterTableRows = $highlighterTableBody.find('tr');
      handler.saveHighlightsToSettings();
    },
    sortAllBoxes: function () {
      boxData.sort(Box.compare);
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
        }),
        lineWasDirty = lineDataInfo.isDirty();
      await handler.update.boxData(layer._leaflet_id, newBox);
      handler.update.form(newBox);
      if (lineWasDirty) {
        newBox.text = $groundTruthInputField.val();
      }
      handler.sortAllBoxes();
    },
    selectRectangle: function (event) {
      if (event.target.editing.enabled() || mapState == 'deleting') {
        return;
      }
      var
        shape = event.target;
      handler.style.remove(selectedPoly);
      handler.map.disableEditBox(selectedPoly);
      handler.focusBoxID(shape._leaflet_id);
      handler.map.enableEditBox(shape);
      handler.sortAllBoxes();
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
    set: {
      mapResize: async function (height, animate) {
        // TODO: refresh jquery selector. It does not work even though it shoud.
        // $map[0].animate({ height: height }, animate ? 500 : 0);
        $('#mapid').animate({ height: height }, animate ? 500 : 0);
      },
      mapSize: async function (options, animate = true) {
        var
          heightMap = {
            'short': 300,
            'medium': 500,
            'tall': 700
          },
          bounds = new L.LatLngBounds();

        var newHeight = heightMap[options.height];

        await handler.set.mapResize(newHeight, animate);

        if (selectedPoly != undefined) {
          selectedPoly
            .getBounds()
            .extend(selectedPoly.getBounds());
        }
        // setTimeout(function () { map.invalidateSize({ pan: true }) }, 500);
      },
      appAppearance: function (value) {
        var docClassesRef = $document[0].documentElement.classList;
        docClassesRef.remove(...docClassesRef);
        docClassesRef.toggle(value);
      },
      loadingState: function (object) {
        if (object.main != undefined) {
          if (object.main) {
            $map.addClass('loading');
            if (image != undefined) {
              $(image._image).animate({ opacity: 0.3 }, 200);
            }
          } else {
            $map.removeClass('loading');
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
    update: {
      settingsModal: async function () {
        // Toolbar Actions
        for (const [key, value] of Object.entries(appSettings.interface.toolbarActions)) {
          const path = 'interface.toolbarActions.' + key;
          const checkbox = $checkboxes.find(`input[name="${path}"]`);
          checkbox.prop('checked', value);
          $('button[name="' + path + '"]').parent().toggle(appSettings.interface.toolbarActions[key]);
        }
        // Appearance
        const appearancePath = 'interface.appearance';
        document.querySelector(`input[name='${appearancePath}'][value='${appSettings.interface.appearance}']`).checked = true;
        handler.set.appAppearance(appSettings.interface.appearance);
        // Image View
        const imageViewPath = 'interface.imageView';
        document.querySelector(`input[name='${imageViewPath}'][value='${appSettings.interface.imageView}']`).checked = true;
        handler.set.mapSize({ height: appSettings.interface.imageView });
        // Workflow
        for (const [key, value] of Object.entries(appSettings.interface.workflow)) {
          const path = 'interface.workflow.' + key;
          const checkbox = $checkboxes.find(`input[name="${path}"]`);
          checkbox.prop('checked', value);
          $('#' + key).toggle(appSettings.interface.workflow[key]);
        }
        const workflowPath = 'interface.workflow';
        document.querySelector
        // On Image Load
        for (const [key, value] of Object.entries(appSettings.behavior.onImageLoad)) {
          const path = 'behavior.onImageLoad.' + key;
          document.querySelector(`input[name='${path}']`).checked = value;
        }
        // Warrning Messages
        for (const [key, value] of Object.entries(appSettings.behavior.alerting)) {
          const path = 'behavior.alerting.' + key;
          document.querySelector(`input[name='${path}']`).checked = value;
        }
        // Convenience Features
        for (const [key, value] of Object.entries(appSettings.behavior.convenience)) {
          const path = 'behavior.convenience.' + key;
          document.querySelector(`input[name='${path}']`).checked = value;
        }
        // Highlighter
        for (const [key, value] of Object.entries(appSettings.highlighter.textHighlighting)) {
          if (key != 'highlightsPatterns') {
            const path = 'highlighter.textHighlighting.' + key;
            document.querySelector(`input[name='${path}']`).checked = value;
          }
        }
        // Invisibles Toggle
        if (appSettings.interface.showInvisibles) {
          $invisiblesToggleButton.addClass('active');
        } else {
          $invisiblesToggleButton.removeClass('active');
        }
      },
      progressBar: function (options = {}) {
        if (options.reset) {
          $progressLabel.text('');
          return;
        }
        if (options.type == 'tagging') {
          var
            currentPosition = boxData.indexOf(selectedBox);
          if ($positionSlider.slider('get max') != boxData.length) {
            handler.update.slider({
              value: currentPosition + 1,
              max: boxData.length
            });
          } else {
            handler.update.slider({ value: currentPosition + 1 });
          }
          if (boxData.every(box => box.filled)) {
            var
              modifiedLines = boxData.filter(box => box.committed);
            $progressSlider.progress({
              value: modifiedLines.length,
              total: boxData.length,
              text: {
                active: 'Updating: {value} out of {total} / {percent}%',
              }
            })
            return;
          } else {
            $progressSlider.removeClass('active indicating');
            var
              textLines = boxData.filter(box => box.filled);
            $progressSlider.progress({
              value: textLines.length,
              total: boxData.length,
              text: {
                active: 'Tagging: {value} out of {total} / {percent}%',
              }
            });
          }
          return;
        } else {
          $progressSlider.addClass('indicating');
          if (options.type == 'ocr') {
            $progressSlider.progress({
              value: options.progress,
              total: 1,
              text: {
                active: 'Analyzing Image: {percent}%',
              }
            });
            return;
          } else if (options.type == 'initializingWorker') {
            $progressSlider.progress({
              value: 0,
              total: 1,
              text: {
                active: options.status + '…',
              }
            });
          } else if (options.type = 'regeneratingTextData') {
            $progressSlider.progress({
              value: options.value,
              total: options.total,
              text: {
                active: 'Regenerating Text Data…',
              }
            });
          }
        }
      },
      slider: function (options) {
        if (options.max) handler.init.slider();
        if (options.value) $positionSlider.slider('set value', options.value, fireChange = false);
        if (options.min) $positionSlider.slider('setting', 'min', options.min);
        return;
      },
      boxData: function (polyid, newData) {
        var
          isUpdated = false,
          oldBoxIndex = boxData.findIndex(function (x) {
            return x.polyid == polyid;
          }),
          // if oldBoxIndex is -1 then that box doesn't exist and data is new
          oldData = oldBoxIndex > -1 ? boxData[oldBoxIndex] : boxData[0];
        newData.polyid = polyid
        // check if data is different
        if (oldData.committed || !oldData.equals(newData)) {
          isUpdated = true;
          if (oldData.text != '') {
            newData.committed = true;
          }
        }
        boxData[oldBoxIndex] = newData
        boxDataInfo.setDirty();
        lineDataInfo.setDirty(false);
        handler.update.progressBar({ type: 'tagging' });
        return isUpdated;
      },
      boxCoordinates: function () {
        var polyid = parseInt($groundTruthInputField.attr('boxid')),
          newBoxData = new Box({
            text: $groundTruthInputField.val(),
            x1: Math.round($x1Field.val()),
            y1: Math.round($y1Field.val()),
            x2: Math.round($x2Field.val()),
            y2: Math.round($y2Field.val()),
          }),
          isUpdated = handler.update.boxData(polyid, newBoxData);
        handler.update.rectangle(polyid, newBoxData);
      },
      rectangle: function (polyid, data) {
        var
          box = boxLayer.getLayer(polyid);
        box.setBounds([[data.y1, data.x1], [data.y2, data.x2]]);
      },
      form: function (box) {
        selectedBox = box;
        $groundTruthInputField.val(box.text);
        $groundTruthInputField.attr('boxid', box.polyid);
        $x1Field.val(box.x1);
        $y1Field.val(box.y1);
        $x2Field.val(box.x2);
        $y2Field.val(box.y2);
        $groundTruthInputField.focus();
        $groundTruthInputField.select();
        handler.update.colorizedBackground();
        handler.update.progressBar({ type: 'tagging' });
        lineDataInfo.setDirty(false);
        handler.close.popups();
      },
      downloadButtonsLabels: function (options = {}) {
        var icon = document.createElement('i');
        icon.className = 'download icon';
        if (options.boxDownloadButton) {
          $downloadBoxFileButton.html(icon.cloneNode(true));
          $downloadBoxFileButton.html(options.boxDownloadButton);
        }
        if (options.groundTruthDownloadButton) {
          $downloadGroundTruthFileButton.html(icon.cloneNode(true));
          $downloadGroundTruthFileButton.html(options.groundTruthDownloadButton);
        }
      },
      colorizedBackground: async function () {
        $colorizedOutputForms.each(async function () {
          var
            inputField = $(this).find('.colorized-input-field'),
            outputField = $(this).find('.colorized-output-field')[0],
            colorizedText = await handler.colorizeText(inputField.val());
          outputField.innerHTML = colorizedText;

        });
      },
      cookie: function () {
        Cookies.set('appSettings', JSON.stringify(appSettings));
      },
      appSettings: function ({ path, value, cookie }) {
        if (cookie) {
          appSettings = { ...appSettings, ...cookie };
        } else {
          const
            pathElements = path.split('.'),
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
          handler.update.cookie();

          setTimeout(() => {
            $settingsModalStatus[0].innerHTML = 'Settings saved!';
          }, 100)
          inlineLoader.className = 'ui mini active fast inline loader';
          $settingsModalStatus[0].innerHTML = '';
          $settingsModalStatus[0].appendChild(inlineLoader);
        }
        handler.update.settingsModal();
      },
      patternLabels: function () {
        $highlighterLabels.empty();
        const highlights = handler.getHighlighters();
        for (const key in highlights) {
          if (highlights.hasOwnProperty(key)) {
            const
              highlight = highlights[key],
              color = highlight.color,
              itemDiv = document.createElement('div'),
              colorDiv = document.createElement('div'),
              nameSpan = document.createElement('span');
            itemDiv.className = 'item';
            colorDiv.className = `ui mini ${color} empty circular label text-highlighter`;
            nameSpan.className = 'ui text';
            nameSpan.innerText = highlight.name;
            itemDiv.appendChild(colorDiv);
            itemDiv.appendChild(nameSpan);
            $highlighterLabels.append(itemDiv);
          }
        }
      },
    },
    receiveDroppedFiles: async function (event) {
      if (event.length > 2) {
        handler.notifyUser({
          title: 'Too many files',
          message: 'Upload an image and, optionally, a box file.',
          type: 'error',
        });
        return;
      }
      if (event.length < 1) {
        notifyUser({
          title: 'No files',
          message: 'You need to drop at least one file.',
          type: 'error',
        });
        return;
      }
      var
        files = event;
      files.forEach(function (file) {
        if (file.type.includes('image')) {
          imageFile = file;
        } else if (file.name.endsWith('.box')) {
          boxFile = file;
        } else {
          handler.notifyUser({
            title: 'Invalid File Type',
            message: 'You can only upload an image and a box file.',
            type: 'error',
          });
          return;
        }
      });

      if (!imageFile && !imageFileInfo.isProcessed()) {
        handler.notifyUser({
          title: 'No image file',
          message: 'You need at least one image file.',
          type: 'error',
        });
        return;
      }
      if (imageFile) {
        await handler.load.imageFile(imageFile);
      }
      if (boxFile) {
        await handler.load.boxFile(boxFile);
      }
    },
    init: {
      slider: function () {
        $positionSlider.slider({
          min: 1,
          max: boxData.length,
          step: 1,
          start: 1,
          smooth: true,
          labelDistance: 50,
          onChange: function (value) {
            if (currentSliderPosition != value &&
              value > 0 &&
              value <= boxData.length) {
              handler.focusBoxID(boxData[value - 1].polyid);
              currentSliderPosition = value;
            }
          },
          onMove: function (value) {
            if (currentSliderPosition != value &&
              value > 0 &&
              value <= boxData.length) {
              handler.focusBoxID(boxData[value - 1].polyid);
              currentSliderPosition = value;
            }
          },
        });
        $positionSlider.off('keydown.slider');
        $document.off('keydown.slider1');
      },
    },
    process: {
      workerLogMessage: function (message) {
        if (message.status == 'recognizing text') {
          message.type = 'ocr';
        } else {
          message.type = 'initializingWorker';
        }
        // suppress log messages
        if (!suppressLogMessages[message.status]) {
          handler.update.progressBar(message);
        }
        return message;
      },
      boxFile: function (event) {
        var
          content = event.target.result;
        handler.getBoxFileType(content);
        if (content && content.length) {
          boxLayer.clearLayers();
          boxData = [];
          if (boxFileType == BoxFileType.WORDSTR) {
            handler.process.wordstr(content);
          } else if (boxFileType == BoxFileType.CHAR_OR_LINE) {
            handler.process.char_or_line(content);
          } else {
            console.warn('invalid file format');
          }
          map.addLayer(boxLayer);
        }
        handler.sortAllBoxes();
        selectedBox = handler.getBoxContent();
        handler.focusBoxID(selectedBox.polyid);
        handler.update.colorizedBackground();
      },
      wordstr: function (content) {
        var lines = content.split(/\r?\n/);
        lines.forEach(function (line) {
          if (line.startsWith('WordStr ')) {
            var [dimensions, actualText] = line.split('#');
            dimensions = dimensions.split(' ');
            var box = new Box({
              text: actualText,
              x1: parseInt(dimensions[1]),
              y1: parseInt(dimensions[2]),
              x2: parseInt(dimensions[3]),
              y2: parseInt(dimensions[4]),
            });

            var rectangle = L.rectangle([[box.y1, box.x1], [box.y2, box.x2]]);
            rectangle.on('edit', handler.editRectangle);
            rectangle.on('click', handler.selectRectangle);
            handler.style.remove(rectangle);
            boxLayer.addLayer(rectangle);
            box.polyid = boxLayer.getLayerId(rectangle);
            boxData.push(box);
          }
        });
      },
      char_or_line: function (content) {
      },
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
    load: {
      eventListeners: function () {
        $settingsModal[0].addEventListener('change', function (event) {
          const
            path = event.target.name,
            value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
          handler.update.appSettings({ path: path, value: value });
        });
      },
      settings: function () {
        $settingsMenuItems.tab();
        $settingsModal.modal({
          inverted: false,
          blurring: true,
          onHidden: function () {
            $settingsModalStatus.text("");
            var
              title = '',
              message = '';
            if (invalidPatterns) {
              title = 'Invalid Patterns',
                message = 'Some enabled highlighters have invalid patterns. Please fix them or disable the highlighters.';
            } else if (identicalPatternNames) {
              title = 'Duplicate Pattern Names',
                message = 'Some highlighter names are the same. Please give them different names.';
            }
            if (message != '') {
              handler.notifyUser({
                title: title,
                message: message,
                type: 'error',
                actions: [{
                  text: 'Fix now',
                  click: handler.open.settingsModal.bind(handler.open, 'highlighter-settings'),

                }]
              });
            }
          }
        });
        const cookieValue = Cookies.get('appSettings');
        if (cookieValue) {
          cookieSettings = JSON.parse(cookieValue);
          handler.update.appSettings({ cookie: cookieSettings });
        } else {
          handler.update.settingsModal();
        }
      },
      popups: function () {
        $imageFileInput.popup({
          popup: $useSamplePopup,
          position: 'top left',
          hoverable: true,
          delay: {
            hide: 800,
          }

        })
      },
      unicodeData: async function () {
        await $.ajax({
          url: '../../assets/unicodeData.csv',
          dataType: 'text',
          success: function (data) {
            var
              parsedData = $.csv.toObjects(data, {
                separator: ';',
                delimiter: '"',
              });
            unicodeData = parsedData;
          }
        });
      },
      dropzone: function () {
        $html.dropzone({
          url: handler.receiveDroppedFiles,
          uploadMultiple: true,
          parallelUploads: 3,
          disablePreviews: true,
          clickable: false,
          acceptedFiles: "image/*,.box",
        });
        $html.on('drag dragenter dragover', function (event) {
          event.preventDefault();
          event.stopPropagation();

          if ($html.hasClass('dz-drag-hover')) {
            $dropzone
              .dimmer('show')
              .addClass('raised');
          }
          window.setTimeout(function () {
            if (!$html.hasClass('dz-drag-hover')) {
              $dropzone
                .dimmer('hide')
                .removeClass('raised');
            }
          }, 1500);
        });
        $html.on('drop', function (event) {
          event.preventDefault();
          event.stopPropagation();

          if (!$html.hasClass('dz-drag-hover')) {
            $dropzone
              .transition('pulse');
          }
        });
      },
      sampleImageAndBox: async function (event) {
        handler.load.imageFile(event, true);
        handler.load.boxFile(event, true);
        handler.close.settingsModal();
      },
      boxFile: async function (e, sample = false) {
        if (boxDataInfo.isDirty()) {
          var
            response = await handler.askUser({
              title: 'Unsaved Changes',
              message: 'You did not download current progress. Do you want to overwrite existing data?',
              type: 'uncommittedChangesWarning',
              actions: [{
                text: 'Cancel',
                class: 'cancel',
              }, {
                text: 'Yes',
                class: 'positive',
              }],
            });
          if (!response) return false;
        }
        var
          reader = new FileReader(),
          defaultBoxUrl = '../../assets/sampleImage.box',
          file = null;
        if (sample) {
          file = new File([await (await fetch(defaultBoxUrl)).blob()], 'sampleImage.box');
        } else if (e.name.includes('box')) {
          file = e;
        } else {
          file = this.files[0];
        }

        var fileExtension = file.name.split('.').pop();
        if (fileExtension != 'box') {
          handler.notifyUser({
            title: 'Invalid File Type',
            message: 'Expected box file. Received ' + fileExtension + ' file.',
            type: 'error',
          });
          $boxFileInput.val(boxFileName);
          return false;
        } else if (imageFileName != file.name.split('.').slice(0, -1).join('.') && imageFileName != undefined) {
          var
            response = await handler.askUser({
              title: 'File Names Mismatch',
              message: 'Expected box file with name ' + file.name + '. Received ' + imageFileName + '.<br> Are you sure you want to continue?',
              type: 'differentFileNameWarning',
              actions: [{
                text: 'No',
                class: 'cancel',
              }, {
                text: 'Yes',
                class: 'positive',
              }],
            });
          if (!response) {
            $boxFileInput.val(boxFileNameForButton);
            return false;
          }
        }
        reader.readAsText(file);
        file.name.split('.).slice(0, -1').join('.');
        boxFileNameForButton = file;
        $(reader).on('load', handler.process.boxFile);
      },
      imageFile: async function (e, sample = false) {
        if (boxDataInfo.isDirty() || lineDataInfo.isDirty()) {
          var response = await handler.askUser({
            title: 'Unsaved Changes',
            message: 'You did not download current progress. Do you want to overwrite existing data?',
            type: 'uncommittedChangesWarning',
            actions: [{
              text: 'Cancel',
              class: 'cancel',
            }, {
              text: 'Yes',
              class: 'positive',
            }],
          });
          if (!response) {
            $imageFileInput.val(imageFileNameForButton);
            return false;
          }
        }
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
          handler.create.map('mapid');
          map.eachLayer(function (layer) {
            map.removeLayer(layer);
          });

          imageHeight = this.height;
          imageWidth = this.width;

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
        handler.update.downloadButtonsLabels({
          boxDownloadButton: imageFileName + '.box',
          groundTruthDownloadButton: imageFileName + '.gt.txt'
        });

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
        if (appSettings.behavior.onImageLoad.detectAllLines && !sample) {
          var response = await handler.generate.initialBoxes(
            includeSuggestions = appSettings.behavior.onImageLoad.includeTextForDetectedLines
          );
        }
        handler.set.loadingState({ buttons: false });
        if (appSettings.behavior.onImageLoad.detectAllLines) {
          handler.focusGroundTruthField();
        }
        $(image._image).animate({ opacity: 1 }, 500);
        imageFileInfo.setProcessed();
      }
    },
    focusGroundTruthField: function () {
      $groundTruthInputField.focus();
      $groundTruthInputField.select();
    },
    focusBoxID: function (id, isUpdated = false) {
      handler.style.remove(selectedPoly, isUpdated);
      handler.map.disableEditBox(selectedBox);
      var box = boxLayer.getLayer(id);
      handler.update.form(boxData.find(x => x.polyid == id));
      handler.map.focusShape(box, isUpdated);
      handler.style.setActive(box);
    },
    submitText: function (event) {
      if (event) event.preventDefault();
      if (this.disabled === true) return false;
      var
        polyid = parseInt($groundTruthInputField.attr('boxid')),
        newData = new Box({
          text: $groundTruthInputField.val(),
          x1: parseInt($x1Field.val()),
          y1: parseInt($y1Field.val()),
          x2: parseInt($x2Field.val()),
          y2: parseInt($y2Field.val()),
          committed: true,
        }),
        modified = handler.update.boxData(polyid, newData);
      handler.update.rectangle(polyid, newData);

      // if all boxes are committed then call download function
      if (boxData.every(box => box.committed)) {
        boxData.forEach(box => box.committed = false);
        if (appSettings.behavior.convenience.autoDownloadBoxFileOnAllLinesComitted) {
          $downloadBoxFileButton.click();
        }
        if (appSettings.behavior.convenience.autoDownloadGroundTruthFileOnAllLinesComitted) {
          $downloadGroundTruthFileButton.click();
        }
      }
      return modified
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
      remove: function (poly, isUpdated = false) {
        if (poly) {
          poly.setStyle(isUpdated ? boxState.boxComitted : boxState.boxInactive);
        }
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
      focusShape: function (box, isUpdated = false) {
        handler.style.remove(selectedPoly, isUpdated);
        handler.map.disableEditBox(selectedPoly);
        map.flyToBounds(box.getBounds(), {
          maxZoom: maxZoom,
          animate: true,
          paddingBottomRight: mapPaddingBottomRight,
          duration: .25,
          easeLinearity: .25,
        });
        selectedPoly = box;
        handler.style.setActive(box);
        handler.focusGroundTruthField();
      },
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
      handler.focusBoxID(box.polyid, isUpdated);
    },
    getPreviBoxContentAndFill: function () {
      var
        isUpdated = handler.submitText(),
        box = handler.getBoxContent(previous = true);
      handler.focusBoxID(box.polyid, isUpdated);

    },
    download: {
      file: async function (type, event) {
        event.preventDefault() && event.stopPropagation();
        if (boxData.length == 0) {
          handler.notifyUser({
            message: 'There is nothing to download!',
            type: 'warning',
          });
          return false;
        }
        if (lineDataInfo.isDirty()) {
          handler.notifyUser({
            message: 'Please commit the current line first.',
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
        if (type == 'box') {
          content = await handler.generate.boxFileContent();
          fileExtension = 'box';
        } else if (type == 'ground-truth') {
          content = await handler.generate.groundTruthContent();
          fileExtension = 'gt.txt';
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
    generate: {
      boxFileContent: async function (event) {
        if (event) event.preventDefault();
        var content = '';
        if (boxFileType == BoxFileType.WORDSTR) {
          for (var box of boxData) {
            content = `${content}WordStr ${box.x1} ${box.y1} ${box.x2} ${box.y2} 0 #${box.text}\n`;
            content = `${content}\t ${box.x2 + 1} ${box.y1} ${box.x2 + 5} ${box.y2} 0\n`;
          }
        }
        return content;
      },
      groundTruthContent: async function (event) {
        if (event) event.preventDefault();
        var content = '';
        if (boxFileType == BoxFileType.WORDSTR) {
          for (var box of boxData) {
            content = `${content}${box.text}\n`;
          }
        }
        return content;
      },
      textSuggestion: async function () {
        $regenerateTextSuggestionForSelectedBoxButton.addClass('disabled double loading');
        suppressLogMessages['recognizing text'] = true;

        if (boxLayer.getLayers().length > 0) {
          var
            results = await handler.ocr.detect([selectedBox]),
            element = boxData.findIndex(el => el.polyid == selectedBox.polyid);
          boxData[element].text = results.length > 0 ? results[0].text : '';
          handler.focusBoxID(boxData[element].polyid)
        }

        suppressLogMessages['recognizing text'] = false;
        $regenerateTextSuggestionForSelectedBoxButton.removeClass('disabled double loading');
      },
      textSuggestions: async function () {
        $regenerateTextSuggestionsButton.addClass('disabled double loading');
        suppressLogMessages['recognizing text'] = true;
        handler.update.progressBar({ reset: true });
        handler.set.loadingState({ buttons: true, main: true });

        if (boxLayer.getLayers().length > 0) {
          var results = await handler.ocr.detect(boxData);
          for (var box of boxData) {
            if (results.length > 0) {
              var result = results.find(function (x) {
                return box.equals(x);
              });
              box.text = result != undefined ? result.text : '';
            }
          }
          handler.focusBoxID(selectedBox.polyid)
        }
        suppressLogMessages['recognizing text'] = false;
        handler.set.loadingState({ buttons: false, main: false });
        $regenerateTextSuggestionsButton.removeClass('disabled double loading');
      },
      initialBoxes: async function (includeSuggestions = true) {
        $redetectAllBoxesButton.addClass('disabled double loading');

        handler.update.progressBar({ reset: true });
        handler.set.loadingState({ buttons: true, main: true });

        boxLayer.clearLayers();
        boxData = [];
        try {
          var
            results = await handler.ocr.detect(),
            textLines = results.data.lines;
          if (textLines.length == 0) {
            handler.set.loadingState({ buttons: false, main: false });
            return false;
          }

          textLines.forEach(line => {
            line.text = line.text.replace(/(\r\n|\n|\r)/gm, "");
          });

          await handler.ocr.insertSuggestions(includeSuggestions, textLines);
          handler.focusBoxID(handler.getBoxContent().polyid);
          handler.set.loadingState({ buttons: false, main: false });
          handler.init.slider()
          boxDataInfo.setDirty(false);
          handler.update.progressBar({ type: 'tagging' });
        } catch (error) {
          console.log(error);
          handler.set.loadingState({ buttons: false, main: false });
        }

        $redetectAllBoxesButton.removeClass('disabled double loading');
      },
    },
    ocr: {
      insertSuggestions: async function (includeSuggestions, textLines) {
        if (boxDataInfo.isDirty()) {
          return !handler.askUser({
            title: 'Warning',
            message: 'Suggestions will be generated from the current lines. Do you want to continue?',
            type: 'replacingTextWarning',
            actions: [{
              text: 'Cancel',
              class: 'cancel',
            }, {
              text: 'yes',
              class: 'positive',
            }]
          });
        }

        boxLayer.clearLayers();
        boxData = [];
        for (var line of textLines) {
          var
            shape = line.bbox,
            text = includeSuggestions ? line.text : '',
            box = new Box({
              text: text,
              x1: shape.x0, // right
              y1: imageHeight - shape.y1, // bottom
              x2: shape.x1, // left
              y2: imageHeight - shape.y0, // top
            }),
            rectangle = new L.rectangle([[box.y1, box.x1], [box.y2, box.x2]]);
          rectangle.on('edit', handler.editRectangle);
          rectangle.on('click', handler.selectRectangle);
          handler.style.remove(rectangle);
          boxLayer.addLayer(rectangle);
          box.polyid = boxLayer.getLayerId(rectangle);
          boxData.push(box);
        }
        map.addLayer(boxLayer);
      },
      detect: async function (boxList = []) {
        if (boxList.length == 0) {
          return await worker.recognize(image._image);
        }
        for (var box of boxList) {
          var layer = boxLayer.getLayer(box.polyid);
          handler.map.disableEditBox(layer);
          handler.style.setProcessing(layer);
          const message = {
            type: 'regeneratingTextData',
            value: boxList.findIndex(x => x.polyid == box.polyid),
            total: boxList.length,
          };
          handler.update.progressBar(message);
          var
            rectangle = {
              left: box.x1,
              top: imageHeight - box.y2,
              width: box.x2 - box.x1,
              height: box.y2 - box.y1,
            },
            result = await worker.recognize(image._image, { rectangle });
          box.text = result.data.text.replace(/(\r\n|\n|\r)/gm, '');
          box.committed = false;
          box.visited = false;
          handler.style.remove(layer);
        };
        return boxList;
      },
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
      },

    },
    toggleInvisibles: function () {
      var
        showInvisibles = !appSettings.interface.showInvisibles,
        path = 'interface.showInvisibles',
        value = showInvisibles;
      handler.update.appSettings({ path, value });
      handler.update.colorizedBackground();
      // $invisiblesToggleButton.toggleClass('active');
      handler.focusGroundTruthField();
    },
    showCharInfoPopup: function (event) {
      if (event.ctrlKey || event.altKey || event.metaKey || event.keyCode == 13) return false;
      var selection = null;
      if (window.getSelection) {
        selection = window.getSelection();
      } else if (document.selection) {
        selection = document.selection.createRange();
      }

      // Firefox bug workaround
      if (selection.toString().length == 0) {
        var
          startPosition = $groundTruthInputField[0].selectionStart,
          endPosition = $groundTruthInputField[0].selectionEnd,
          selection = $groundTruthInputField[0].value.substring(startPosition, endPosition);
      }
      var results = handler.getUnicodeInfo(selection.toString());
      // TODO: replace max length with a programmatic solution
      if (results.length == 0 || results.length > 15) {
        handler.close.popups();
        return false;
      } else {
        var content = handler.create.infoPopupContent(results);
        $groundTruthForm.popup('get popup').css('max-height', '20em');
        $groundTruthForm.popup('get popup').css('overflow', 'visible');
        $groundTruthForm.popup('get popup').css('scrollbar-width', 'none');
        $groundTruthForm.popup('get popup').css('scrollbar-width', 'none');
        $groundTruthForm.popup('get popup').css('-ms-overflow-style', 'none');
        $groundTruthForm.popup('get popup').css('scrollbar-width', 'none');

        if ($groundTruthForm.popup('is visible')) {
          $groundTruthForm.popup('change content (html)', content);
        } else if ($groundTruthForm.popup('is hidden')) {
          $groundTruthForm.popup({ on: 'manual', 'html': content }).popup('show')
        } else {
          console.error('Unknown Char Info popup state');
        }
      }
    },
    bindInputs: function () {
      handler.bindColorizerOnInput();
      $groundTruthInputField.on('input', function () {
        lineDataInfo.setDirty(true);
      })
      $groundTruthInputField.bind('mouseup keyup', handler.showCharInfoPopup)
      $coordinateFields.on('input', handler.update.boxCoordinates);
      $boxFileInput.on('change', handler.load.boxFile);
      $imageFileInput.on('change', handler.load.imageFile);
    },
    bindButtons: function () {
      $nextBoxButton.on('click', handler.getNextBoxContentAndFill);
      $previousBoxButton.on('click', handler.getPreviBoxContentAndFill);
      $downloadBoxFileButton.on('click', handler.download.file.bind(handler.download, 'box'));
      $downloadGroundTruthFileButton.on('click', handler.download.file.bind(handler.download, 'ground-truth'));
      $invisiblesToggleButton.on('click', handler.toggleInvisibles);
      $regenerateTextSuggestionForSelectedBoxButton.on('click', handler.generate.textSuggestion);
      $redetectAllBoxesButton.on('click', handler.generate.initialBoxes);
      $regenerateTextSuggestionsButton.on('click', handler.generate.textSuggestions);
      $settingsButton.on('click', handler.open.settingsModal);
      $settingsButtonForHelpPane.on('click', handler.open.settingsModal.bind(handler.open, 'help-section'));
      $resetButton.on('click', handler.resetAppSettingsAndCookies);
      $useSampleImageButton.on('click', handler.load.sampleImageAndBox);
      $addNewHighligherButton.on('click', handler.addNewHighlighterPattern);
    },
    addBehaviors: function () {
      $groundTruthInputField.focus(function () {
        $groundTruthColorizedOutput.addClass('focused')
      });
      $groundTruthInputField.blur(function () {
        $groundTruthColorizedOutput.removeClass('focused')
      });
    },
    initialize: async function () {
      handler.bindInputs();
      handler.bindButtons();
      handler.addBehaviors();
      $imageFileInput.prop('disabled', false);
      handler.setKeyboardControl('form');
      // handler.set.loadingState({ buttons: false });
      await handler.load.unicodeData();
      handler.load.dropzone();
      handler.load.popups();
      handler.create.defaultHighlighterTable();
      handler.load.settings();
      handler.load.eventListeners();

      handler.saveHighlightsToSettings();

    },
  };

  app.handler = handler;

  // Start the Magic
  app.handler.initialize();

};

// attach ready event
$(document).ready(app.ready);