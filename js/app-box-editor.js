window.app = {
  handler: {}
};

class Box {
  constructor({ text, x1, x2, y1, y2, polyid, visited = false, isModelGeneratedText, modelConfidenceScore = null }) {
    this.text = text;
    this.x1 = x1;
    this.x2 = x2;
    this.y1 = y1;
    this.y2 = y2;
    this.polyid = polyid;
    this.filled = text != '' ? true : false;
    this.visited = visited;
    this.committed = false;
    this.isModelGeneratedText = isModelGeneratedText;
    this.modelConfidenceScore = modelConfidenceScore;
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
    $highlighterLabels = $('#highlighters-labels'),
    $invisiblesToggleButton = $('#invisiblesToggle.ui.button'),
    $redetectAllBoxesButton = $('#redetectAllBoxes'),
    $regenerateTextSuggestionsButton = $('#regenerateTextSuggestions'),
    $regenerateTextSuggestionForSelectedBoxButton = $('#regenerateTextSuggestionForSelectedBox'),
    $ocrModelDropdown = $('#ocrModelDropdown'),
    $ocrModelDropdownInSettings = $('#ocrModelDropdownInSettings'),
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
    $settingsModalStatusMessage = $settingsModalStatus.find('.ui.disabled.tertiary.button'),
    $settingsModalContent = $settingsModal.find('.content'),
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
    $resetButton = $('#resetAppSettings'),
    $addNewHighligherButton = $('#addNewHighlighterPattern'),
    $dropzone = $('div.my-dropzone'),
    $textHighlightingEnabledCheckbox = $(`input[name='highlighter.textHighlighting.textHighlightingEnabled']`),
    $checkboxes = $('.ui.checkbox'),
    $highlighterTableContainer = $('#highlighterTableContainer'),
    $highlighterTableBody = $highlighterTableContainer.find('.ui.celled.table tbody'),
    $highlighterTableRows = $highlighterTableBody.find('tr'),
    $keyboardShortcutsTableContainer = $('#keyboardShortcutsTableContainer'),
    $keyboardShortcutsTableBody = $keyboardShortcutsTableContainer.find('.ui.celled.table tbody'),
    $keyboardShortcutsTableRows = $keyboardShortcutsTableBody.find('tr'),
    $modelConfidenceScoreDetail = $('#modelConfidenceScore'),
    $modelConfidenceScoreEnabledCheckbox = $(`input[name='behavior.workflow.confidenceScoreEnabled']`),
    $appInfoVersion = $('#appInfoVersion'),
    $appInfoUpdated = $('#appInfoUpdated'),

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
    invalidKeyboardShortcuts = false,
    duplicatedKeyboardShortcuts = false,
    suppressLogMessages = {
      'recognizing text': false,
    },
    worker,

    appSettings = {
      localStorageKey: 'appSettings-boxEditor',
      appVersion: null,
      interface: {
        appearance: 'match-device',
        toolbarActions: {
          detectAllLines: true,
          detectSelectedBox: true,
          detectAllBoxes: true,
          invisiblesToggle: true,
          languageModelDropdown: true,
        },
        imageView: 'medium',
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
        workflow: {
          progressIndicator: true,
          positionSlider: true,
          formCoordinateFields: true,
          unicodeInfoPopup: true,
          confidenceScoreEnabled: true,
          autoDownloadBoxFileOnAllLinesComitted: false,
          autoDownloadGroundTruthFileOnAllLinesComitted: false,
        },
        keyboardShortcuts: {
          keyboardShortcutsEnabled: true,
          shortcuts: []
        },
      },
      language: {
        recognitionModel: 'RTS_from_Cyrillic',
        languageModelIsCustom: true,
      },
      highlighter: {
        textHighlighting: {
          textHighlightingEnabled: true,
          highlightsPatterns: [],
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
                currentSpan = currentSpan.replace('space', 'space multiple');
              }
              currentSpan += charSpace;
            } else {
              currentSpan += char;
            }
          }
          currentScript = spanClass;
        } else {
          spanClass = 'other';
          if (currentSpan !== '') {
            colorizedText += '</span>' + currentSpan;
          }
          currentSpan = '<span class="' + spanClass + '">' + char;
          currentScript = spanClass;
        }
      }
      colorizedText += '</span>' + currentSpan;
      return colorizedText;
    },
    getHighlighters: function () {
      var patterns = {};
      if ($textHighlightingEnabledCheckbox[0].checked) {
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
      if ($textHighlightingEnabledCheckbox[0].checked) {
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
      handler.update.colorizedBackground();
      handler.update.patternLabels();
      handler.update.localStorage();
    },
    saveKeyboardShortcutsToSettings: function () {
      if (appSettings.behavior.keyboardShortcuts.keyboardShortcutsEnabled) {
        var
          shortcuts = [],
          errorMessages = [];
        $keyboardShortcutsTableRows.each(function (index, elem) {
          handler.unhighlightCell(elem.querySelector('td:nth-child(2)'));
          var
            enabled = elem.querySelector('td:nth-child(1) .checkbox input').checked,
            name = elem.querySelector('td:nth-child(2) input[name=action]').value,
            keyCombo = elem.querySelector('td:nth-child(3)').innerText,
            action = availableShortcutActions.find(action => action.name === name).action;
          // target = availableShortcutActions.find(action => action.name === name).target;
          try {
            shortcuts.push({
              enabled: enabled,
              keyCombo: keyCombo,
              name: name,
              action: action,
              // target: target,
            });
          } catch (error) {
            handler.highlightCell(elem.querySelector('td:nth-child(2)'));
            errorMessages.push({ keyCombo, enabled, error });
          }
        });

        duplicatedKeyboardShortcuts = false;
        shortcutKeys = shortcuts.map(function (shortcut) {
          return shortcut.keyCombo.toUpperCase();
        });
        shortcutKeysSet = [...new Set(shortcutKeys)];
        if (shortcutKeys.length != shortcutKeysSet.length) {
          duplicatedKeyboardShortcuts = true;
        }
        appSettings.behavior.keyboardShortcuts.shortcuts = shortcuts;
      }
      if (appSettings.behavior.keyboardShortcuts.shortcuts.length > 0) {
        // add listener for keyboard shortcuts
        handler.load.keyboardShortcuts();
      }
      handler.update.localStorage();
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
    clearLocalStorage: function () {
      localStorage.removeItem(appSettings.localStorageKey);
      location.reload();
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
    keyboardShortcuts: {
      getKeys: function () {
        return appSettings.keyboardShortcuts;
      },
      register: function () {
        handler.keyboardShortcuts.setUpPreview();

        // $document[0].addEventListener('keydown', handler.keyboardShortcuts.handleKeyDown);
        // $document[0].addEventListener('keyup', handler.keyboardShortcuts.handleKeyUp);

        handler.keyboardShortcuts.updatePreview();
      },
      has: function (key) {
        return appSettings.keyboardShortcuts.hasOwnProperty(key);
      },
      handleKeyDown: function (event) {
        if (handler.keyboardShortcuts.isModifierKey(event.key)) {
          pressedModifiers[event.key] = true;
          return;
        }
        const
          // modifierKeys are all keys of pressedModifiers that have value true

          modifierKeys = Object.keys(pressedModifiers).filter(
            key => pressedModifiers[key]
          ).join(' + '),
          key = (modifierKeys ? modifierKeys + ' + ' : '') + event.key.toUpperCase();

        if (handler.keyboardShortcuts.has(key)) {
          handler.notifyUser({
            title: 'Shorcut Exists',
            message: `Shortcut <strong>${key}</strong> has already been registered.`,
            type: 'warning',
          })
          return;
        }

        handler.keyboardShortcuts.add(key);
        handler.keyboardShortcuts.updatePreview();

      },
      add: function (key) {
        appSettings.keyboardShortcuts[key] = key;
      },
      handleKeyUp: function (event) {
        if (handler.keyboardShortcuts.isModifierKey(event.key)) {
          pressedModifiers[event.key] = false;
        }
        // console.log(pressedModifiers);
      },
      isNavigationKey: function (key) {
        navigationKeys = ['Tab', 'ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'];
        return navigationKeys.includes(key) ? true : false;
      },
      isModifierKey: function (key) {
        modifiers = ['Alt', 'Shift', 'Control', 'Meta'];
        return modifiers.includes(key) ? true : false;
      },
      setUpPreview: function () {

      },
      updatePreview: function () {
        console.log(handler.keyboardShortcuts.getKeys());
      },
    },
    setKeyboardControl: function (context) {
      if (context == 'prompt') {
        $window.off('keydown');
      } else if (context == 'form') {
        handler.load.keyboardShortcuts();
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
    create: {
      defaultKeyboardShortcutsTable: async function () {
        const
          table = document.createElement('table'),
          thead = document.createElement('thead'),
          theadRow = document.createElement('tr'),
          headers = ['', 'Action', 'Key Combo', ''],
          tbody = document.createElement('tbody'),
          localStorageValue = localStorage.getItem(appSettings.localStorageKey);
        table.className = 'ui unstackable celled table';
        thead.appendChild(theadRow);
        for (const header of headers) {
          const th = document.createElement('th');
          th.className = header ? '' : 'collapsing';
          th.className = header === 'Key Combo' ? 'eight wide' : '';
          th.className = header === 'Action' ? 'eight wide' : '';
          th.textContent = header;
          theadRow.appendChild(th);
        }

        var shortcuts = [];
        try {
          if (localStorageValue) {
            const localStorageSettings = JSON.parse(localStorageValue);
            shortcuts = localStorageSettings.behavior.keyboardShortcuts.shortcuts;
            if (shortcuts.length > 0) {
              shortcuts.forEach(function (shortcut) {
                const row = handler.create.keyboardShortcutRow(shortcut.enabled, shortcut.keyCombo, shortcut.name);
                tbody.appendChild(row);
              });
            }
          }
        } catch (error) {
          console.error(error);
        }

        if (!localStorageValue || shortcuts.length == 0) {
          const rows = [
            { enabled: true, keyCombo: 'ENTER', name: 'Move to next box' },
            { enabled: true, keyCombo: 'Shift + ENTER', name: 'Move to previous box' },
            // { enabled:availa
          ];
          rows.forEach(function (row) {
            const rowElement = handler.create.keyboardShortcutRow(row.enabled, row.keyCombo, row.name);
            tbody.appendChild(rowElement);
          });
        }

        table.appendChild(thead);
        table.appendChild(tbody);

        $keyboardShortcutsTableContainer[0].insertBefore(table, $keyboardShortcutsTableContainer[0].firstChild);

        $keyboardShortcutsTableBody = $keyboardShortcutsTableContainer.find('.ui.celled.table tbody');
        $keyboardShortcutsTableRows = $keyboardShortcutsTableBody.find('tr');

        return table;
      },
      defaultHighlighterTable: async function () {
        const
          table = document.createElement('table'),
          thead = document.createElement('thead'),
          theadRow = document.createElement('tr'),
          headers = ['', 'Name', 'Color', 'Pattern', ''],
          tbody = document.createElement('tbody'),
          localStorageValue = localStorage.getItem(appSettings.localStorageKey);
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
        if (localStorageValue) {
          const localStorageSettings = JSON.parse(localStorageValue);
          highlights = localStorageSettings.highlighter.textHighlighting.highlightsPatterns;
          if (highlights.length > 0) {
            highlights.forEach(function (highlight) {
              const row = handler.create.highlighterRow(highlight.enabled, highlight.name, highlight.color, highlight.pattern);
              tbody.appendChild(row);
            });
          }
        }

        if (!localStorageValue || highlights.length == 0) {
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

        $highlighterTableBody = $highlighterTableContainer.find('.ui.celled.table tbody'),
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
          checkboxCell = handler.create.checkboxCell(name, {
            onChange: handler.saveHighlightsToSettings
          }),
          nameCell = handler.create.editableTextCell(name, {
            onChange: handler.saveHighlightsToSettings
          }),
          colorCell = handler.create.colorCell(color, {
            onChange: handler.saveHighlightsToSettings
          }),
          patternCell = handler.create.editableTextCell(pattern, {
            onChange: handler.saveHighlightsToSettings
          }),
          actionsCell = handler.create.actionsCell({
            onChange: handler.saveHighlightsToSettings
          });
        row.appendChild(checkboxCell);
        row.appendChild(nameCell);
        row.appendChild(colorCell);
        row.appendChild(patternCell);
        row.appendChild(actionsCell);

        return row;
      },
      keyboardShortcutRow: function (enabled, keyCombo, name) {
        const
          row = document.createElement('tr'),
          checkboxCell = handler.create.checkboxCell(keyCombo, {
            onChange: handler.saveKeyboardShortcutsToSettings
          }),
          shortcutsActionCell = handler.create.shortcutActionCell(name, {
            onChange: handler.saveKeyboardShortcutsToSettings
          }),
          keyComboCell = handler.create.editableTextCell(keyCombo, {
            onChange: handler.saveKeyboardShortcutsToSettings
          }),
          actionsCell = handler.create.actionsCell({
            onChange: handler.saveKeyboardShortcutsToSettings
          });
        row.appendChild(checkboxCell);
        row.appendChild(shortcutsActionCell);
        row.appendChild(keyComboCell);
        row.appendChild(actionsCell);

        return row;
      },
      checkboxCell: function (name, params = {}) {
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
            params.onChange();
          },
        });
        cell.appendChild(div);
        return cell;
      },
      editableTextCell: function (name, params = {}) {
        const
          cell = document.createElement('td');
        cell.contentEditable = true;
        cell.innerText = name;
        $(cell).on('input', params.onChange);
        return cell;
      },
      colorCell: function (color, params = {}) {
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
          onChange: params.onChange,
        });

        if (color) {
          $(dropdownDiv).dropdown('set selected', color, true);
        } else {
          $(dropdownDiv).dropdown('set selected', colors[Math.floor(Math.random() * colors.length)], true);
        }
        cell.appendChild(dropdownDiv);

        return cell;
      },
      shortcutActionCell: function (action, params = {}) {
        const
          cell = document.createElement('td');
        dropdownDiv = document.createElement('div'),
          hiddenInput = document.createElement('input'),
          dropdownIcon = document.createElement('i'),
          defaultText = document.createElement('div'),
          menuDiv = document.createElement('div');
        cell.className = 'collapsing';
        cell.setAttribute('data-label', 'Action');
        dropdownDiv.className = 'ui fluid search selection dropdown';
        hiddenInput.type = 'hidden';
        hiddenInput.name = 'action';
        dropdownIcon.className = 'dropdown icon';
        defaultText.className = 'default text';
        defaultText.textContent = 'Action...';
        menuDiv.className = 'menu';
        availableShortcutActions.forEach(function (action) {
          const
            itemDiv = document.createElement('div'),
            actionIcon = document.createElement('i'),
            actionText = document.createElement('span');
          itemDiv.className = 'item';
          itemDiv.setAttribute('data-value', action.name);
          actionIcon.className = `ui small ${action.icon} icon`;
          actionText.textContent = action.name;
          itemDiv.appendChild(actionIcon);
          itemDiv.appendChild(actionText);
          menuDiv.appendChild(itemDiv);
        });
        dropdownDiv.appendChild(hiddenInput);
        dropdownDiv.appendChild(dropdownIcon);
        dropdownDiv.appendChild(defaultText);
        dropdownDiv.appendChild(menuDiv);

        $(dropdownDiv).dropdown({
          onChange: params.onChange,
        });

        if (action) {
          $(dropdownDiv).dropdown('set selected', action, true);
        }
        cell.appendChild(dropdownDiv);
        return cell;
      },
      actionsCell: function (params = {}) {
        const
          actionCell = document.createElement('td'),
          deleteButton = document.createElement('i');
        actionCell.className = 'single line';
        actionCell.setAttribute('data-label', 'Edit');
        deleteButton.className = 'large red times circle link icon';
        $(deleteButton).on('click', function () {
          $(this).parent().parent().remove();
          $highlighterTableBody = $highlighterTableContainer.find('.ui.celled.table tbody'),
            $highlighterTableRows = $highlighterTableBody.find('tr');
          params.onChange;
        });
        actionCell.appendChild(deleteButton);
        return actionCell;
      },
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
          zoomControl = new L.Control.Zoom({ position: 'topright' }),
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
      $highlighterTableBody = $highlighterTableContainer.find('.ui.celled.table tbody');
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
      },
      appAppearance: function (value) {
        var docClassesRef = $document[0].documentElement.classList;
        docClassesRef.remove(...docClassesRef);
        docClassesRef.toggle(value);
      },
      loadingState: function (object) {
        if (object.main != undefined) {
          if (object.main) {
            $map.addClass('loading disabled');
            $progressSlider.addClass('disabled');
            $positionSlider.addClass('disabled');
            if (image != undefined) {
              $(image._image).animate({ opacity: 0.3 }, 200);
            }
          } else {
            $map.removeClass('loading disabled');
            $progressSlider.removeClass('disabled');
            $positionSlider.removeClass('disabled');
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
          $('#custom-controls [name="' + path + '"]').parent().toggle(appSettings.interface.toolbarActions[key]);
        }
        // Appearance
        const appearancePath = 'interface.appearance';
        document.querySelector(`input[name='${appearancePath}'][value='${appSettings.interface.appearance}']`).checked = true;
        handler.set.appAppearance(appSettings.interface.appearance);
        // Image View
        const imageViewPath = 'interface.imageView';
        document.querySelector(`input[name='${imageViewPath}'][value='${appSettings.interface.imageView}']`).checked = true;
        handler.set.mapSize({ height: appSettings.interface.imageView });
        // On Image Load
        for (const [key, value] of Object.entries(appSettings.behavior.onImageLoad)) {
          const path = 'behavior.onImageLoad.' + key;
          document.querySelector(`input[name='${path}']`).checked = value;
          if (key == 'detectAllLines' && !value) {
            document.querySelector(`input[name="behavior.onImageLoad.includeTextForDetectedLines"]`).disable = true;
            document.querySelector(`input[name="behavior.onImageLoad.includeTextForDetectedLines"]`).parentElement.classList.add('disabled');
          }
        }
        // Warrning Messages
        for (const [key, value] of Object.entries(appSettings.behavior.alerting)) {
          const path = 'behavior.alerting.' + key;
          document.querySelector(`input[name='${path}']`).checked = value;
        }
        // Workflow
        for (const [key, value] of Object.entries(appSettings.behavior.workflow)) {
          const path = 'behavior.workflow.' + key;
          const checkbox = $checkboxes.find(`input[name="${path}"]`);
          checkbox.prop('checked', value);
          $('#' + key).toggle(appSettings.behavior.workflow[key]);
          // }
          // // Convenience Features
          // for (const [key, value] of Object.entries(appSettings.behavior.workflow)) {
          // const path = 'behavior.convenience.' + key;
          document.querySelector(`input[name='${path}']`).checked = value;
          // }
        }
        // Keyboard Shortcuts
        for (const [key, value] of Object.entries(appSettings.behavior.keyboardShortcuts)) {
          if (key != 'shortcuts') {
            const path = 'behavior.keyboardShortcuts.' + key;
            document.querySelector(`input[name='${path}']`).checked = value;
          }
        }
        // Language Models
        // $ocrModelDropdownInSettings.dropdown('set value', appSettings.language.recognitionModel, true);
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
        handler.update.confidenceScoreField(box);
        $groundTruthInputField.focus();
        $groundTruthInputField.select();
        handler.update.colorizedBackground();
        handler.update.progressBar({ type: 'tagging' });
        lineDataInfo.setDirty(false);
        handler.close.popups();
      },
      confidenceScoreField: async function (box) {
        if (!$modelConfidenceScoreEnabledCheckbox[0].checked) {
          $modelConfidenceScoreDetail.text('');
          return;
        }
        $modelConfidenceScoreDetail.text(box.isModelGeneratedText ? `Suggestion Confidence: ${Math.round(box.modelConfidenceScore)}%` : '');
        // colorize if low confidence
        if (box.isModelGeneratedText) {
          colorMap = {
            70: 'red',
            85: 'orange',
            95: 'grey',
            100: 'green',
          }
          for (var lowConfidence in colorMap) {
            if (box.modelConfidenceScore < lowConfidence) {
              $modelConfidenceScoreDetail.addClass(colorMap[lowConfidence]);
              // $modelConfidenceScoreDetail.removeClass('grey');
              break;
            }
            $modelConfidenceScoreDetail.removeClass(Object.values(colorMap).join(' '));
            // $modelConfidenceScoreDetail.addClass('grey');
          }
        }
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
              appSettings = handler.migrateSettings(localStorage.appVersion, true);
              break;
            case 1:
              appSettings = handler.migrateSettings(localStorage.appVersion);
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
      patternLabels: function () {
        $highlighterLabels.empty();
        if (!$textHighlightingEnabledCheckbox[0].checked) return;
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
    migrateSettings: function (oldSettings, downgrade = false) {
      if (downgrade) {
        // Downgrading settings

        // ignore newer settings
      } else {
        // Upgrading settings

        // clear cookies set by versions prior to 1.6.0
        // also remove html script tag for JS Cookie
        const cookies = Cookies.get();
        for (const cookie in cookies) {
          Cookies.remove(cookie);
        }
      }
      return oldSettings;
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
              isModelGeneratedText: false,
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
    load: {
      tesseractWorker: async function () {
        var
          langPathURL = 'https://tessdata.projectnaptha.com/4.0.0_best',
          isGzip = true;
        if (appSettings.language.languageModelIsCustom) {
          langPathURL = '../../assets';
          isGzip = false;
        }
        worker = await Tesseract.createWorker({
          logger: m => handler.process.workerLogMessage(m),
          langPath: langPathURL,
          gzip: isGzip,
        });
        await handler.load.tesseractLanguage();
        await worker.setParameters({
          tessedit_ocr_engine_mode: 1,
          tessedit_pageseg_mode: 1,// 12
        });
        return true;
      },
      tesseractLanguage: async function () {
        await worker.loadLanguage(appSettings.language.recognitionModel);
        await worker.initialize(appSettings.language.recognitionModel);
        return true;
      },
      dropdowns: function () {
        $ocrModelDropdown.dropdown({
          onChange: async function (value, text, $selectedItem) {
            $ocrModelDropdown.addClass('loading');
            handler.set.loadingState({ buttons: true });
            appSettings.language.recognitionModel = value;
            var custom = value == 'RTS_from_Cyrillic' ? true : false;
            if (appSettings.language.languageModelIsCustom != custom) {
              appSettings.language.languageModelIsCustom = custom;
              await handler.load.tesseractWorker();
            } else {
              await handler.load.tesseractLanguage();
            }
            $ocrModelDropdownInSettings.dropdown('set selected', appSettings.language.recognitionModel, true);
            $ocrModelDropdown.removeClass('loading');
            handler.set.loadingState({ buttons: false });
          }
        });
        $ocrModelDropdownInSettings.dropdown({
          onChange: async function (value, text, $selectedItem) {
            // $ocrModelDropdownInSettings.dropdown('set selected', value, true);
            // handler.update.appSettings({
            //   path: $ocrModelDropdownInSettings[0].getAttribute('name'), value: value
            // });
            $ocrModelDropdownInSettings.addClass('loading');
            handler.set.loadingState({ buttons: true });
            appSettings.language.recognitionModel = value;
            var custom = value == 'RTS_from_Cyrillic' ? true : false;
            if (appSettings.language.languageModelIsCustom != custom) {
              appSettings.language.languageModelIsCustom = custom;
              await handler.load.tesseractWorker();
            } else {
              await handler.load.tesseractLanguage();
            }
            $ocrModelDropdown.dropdown('set selected', appSettings.language.recognitionModel, true);
            $ocrModelDropdownInSettings.removeClass('loading');
            handler.set.loadingState({ buttons: false });
          }
        });
      },
      keyboardShortcuts: function () {
        $window.keyup(function (event) {
          if (handler.keyboardShortcuts.isModifierKey(event.key)) {
            pressedModifiers[event.key] = false;
            // console.log('removed', event.key, 'from pressedModifiers', pressedModifiers);
          }
        });
        $window.off('keydown');
        $window.keydown(function (event) {
          // Check if the pressed key is a modifier key
          if (handler.keyboardShortcuts.isModifierKey(event.key)) {
            pressedModifiers[event.key] = true;
            return;
          }
          if (handler.keyboardShortcuts.isNavigationKey(event.key)) {
            handler.showCharInfoPopup(event);
            return;
          }

          // Combine modifiers with the pressed key to form the complete shortcut
          const modifierKeys = Object.keys(pressedModifiers).filter(
            key => pressedModifiers[key]).join("+");
          const key = (modifierKeys ? modifierKeys + "+" : "") + event.key.toUpperCase();
          const matchingAction = appSettings.behavior.keyboardShortcuts.shortcuts.find(action => action.keyCombo.replace(/\s/g, '') === key);

          if (matchingAction && matchingAction.enabled) {
            // console.log('matchingAction:', matchingAction);
            // console.log(event);
            event.preventDefault();
            matchingAction.action();
            return;
          }
          // console.log(key);

          // if (event.keyCode == 13) {
          //   event.preventDefault();
          //   if (event.shiftKey) {
          //     handler.getPreviousBoxContentAndFill();
          //   } else {
          //     handler.getNextBoxContentAndFill();
          //   }
          //   return false;
          // }
        });
      },
      eventListeners: function () {
        $settingsModal[0].addEventListener('change', function (event) {
          const
            path = event.target.name,
            value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
          handler.update.appSettings({ path: path, value: value });
        });
      },
      settings: function () {
        handler.getAppInfo();
        $appInfoVersion.text(appInfo.version);
        appSettings.appVersion = appInfo.version;
        // format date to month date, year
        const date = new Date(appInfo.updated);
        $appInfoUpdated.text(handler.formatDate(date));
        $settingsMenuItems.tab();
        $settingsModal.modal({
          inverted: false,
          blurring: true,
          onHidden: function () {
            // hide status if still visible
            if ($settingsModalStatusMessage[0]) $settingsModalStatusMessage[0].innerHTML = '';
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
        const localStorageValue = localStorage.getItem(appSettings.localStorageKey);
        if (localStorageValue) {
          localStorageSettings = JSON.parse(localStorageValue);
          handler.update.appSettings({ localStorage: localStorageSettings });
        } else {
          handler.update.appSettings({ localStorage: { appVersion: undefined } });
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
        handler.set.loadingState({ buttons: true });
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
        handler.set.loadingState({ main: false, buttons: false });
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
        // Load Tesseract Worker
        await handler.load.tesseractWorker();

        if (appSettings.behavior.onImageLoad.detectAllLines && !sample) {
          var response = await handler.generate.initialBoxes(
            includeSuggestions = appSettings.behavior.onImageLoad.includeTextForDetectedLines
          );
        }
        handler.set.loadingState({ main: false, buttons: false });
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
    focusBoxID: function (id, options = { isUpdated: false, zoom: true }) {
      if (options.isUpdated == undefined) options.isUpdated = false;
      if (options.zoom == undefined) options.zoom = true;
      handler.style.remove(selectedPoly, options.isUpdated);
      handler.map.disableEditBox(selectedBox);
      var box = boxLayer.getLayer(id);
      handler.update.form(boxData.find(x => x.polyid == id));
      if (options.zoom) handler.map.focusShape(box, options.isUpdated);
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
          isModelGeneratedText: false,
          modelConfidenceScore: null,
        }),
        modified = handler.update.boxData(polyid, newData);
      handler.update.rectangle(polyid, newData);

      // if all boxes are committed then call download function
      if (boxData.every(box => box.committed)) {
        boxData.forEach(box => box.committed = false);
        if (appSettings.behavior.workflow.autoDownloadBoxFileOnAllLinesComitted) {
          $downloadBoxFileButton.click();
        }
        if (appSettings.behavior.workflow.autoDownloadGroundTruthFileOnAllLinesComitted) {
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
      setCommitted: function (poly) {
        if (poly) {
          poly.setStyle(boxState.boxComitted);
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
      getMapPosition: function () {
        return map.getBounds();
      },
      invalidateSize: function () {
        setTimeout(function () { map.invalidateSize({ pan: true }) }, 500);
      },
      fitImage: function () {
        map.flyToBounds(image.getBounds(), {
          // paddingBottomRight: mapPaddingBottomRight,
          duration: .25,
          easeLinearity: .25,
          animate: true,
        });
      },
      fitBounds: function (bounds) {
        map.flyToBounds(bounds, {
          maxZoom: maxZoom,
          animate: true,
          paddingBottomRight: mapPaddingBottomRight,
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
          handler.focusBoxID(boxData[element].polyid, { zoom: false })
        }

        suppressLogMessages['recognizing text'] = false;
        $regenerateTextSuggestionForSelectedBoxButton.removeClass('disabled double loading');
      },
      textSuggestions: async function () {
        $regenerateTextSuggestionsButton.addClass('disabled double loading');
        if (boxDataInfo.isDirty()) {
          var response = await handler.askUser({
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

          if (!response) {
            $regenerateTextSuggestionsButton.removeClass('disabled double loading');
            return false;
          }
        }
        suppressLogMessages['recognizing text'] = true;
        handler.update.progressBar({ reset: true });
        handler.set.loadingState({ buttons: true, main: true });
        var mapPosition = handler.map.getMapPosition();
        handler.map.fitImage();

        if (boxLayer.getLayers().length > 0) {
          var results = await handler.ocr.detect(boxData);
          await Promise.all(boxData.map(async (box) => {
            if (results.length > 0) {
              var result = results.find(function (x) {
                return box.equals(x);
              });
              box.text = result != undefined ? result.text : '';
            }
          }));
          handler.focusBoxID(selectedBox.polyid, { zoom: false })
        }
        suppressLogMessages['recognizing text'] = false;
        handler.map.fitBounds(mapPosition);
        handler.set.loadingState({ buttons: false, main: false });
        $regenerateTextSuggestionsButton.removeClass('disabled double loading');
      },
      initialBoxes: async function (includeSuggestions = true) {
        $redetectAllBoxesButton.addClass('disabled double loading');

        if (boxDataInfo.isDirty()) {
          var response = await handler.askUser({
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

          if (!response) {
            $redetectAllBoxesButton.removeClass('disabled double loading');
            return false;
          }
        }
        handler.update.progressBar({ reset: true });
        handler.set.loadingState({ buttons: true, main: true });
        handler.map.fitImage();
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
        boxLayer.clearLayers();
        boxData = [];
        for (var line of textLines) {
          var
            shape = line.bbox,
            text = includeSuggestions ? line.text : '',
            box = new Box({
              text: text,
              isModelGeneratedText: true,
              modelConfidenceScore: line.confidence,
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
          box.isModelGeneratedText = true;
          box.modelConfidenceScore = result.data.confidence;
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
      if (!appSettings.behavior.workflow.unicodeInfoPopup) return;
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
      $textHighlightingEnabledCheckbox.checkbox({
        onChange: function () {
          handler.saveHighlightsToSettings();
        }
      });
      $modelConfidenceScoreEnabledCheckbox.checkbox({
        onChange: async function () {
          await handler.update.confidenceScoreField(selectedBox);
        }
      });
      $groundTruthInputField.bind('mouseup', handler.showCharInfoPopup)
      $coordinateFields.on('input', handler.update.boxCoordinates);
      $boxFileInput.on('change', handler.load.boxFile);
      $imageFileInput.on('change', handler.load.imageFile);
      $checkboxes.checkbox();
      $checkboxes.filter('.master')
        .checkbox({
          // check all children
          onChecked: function () {
            var
              $childCheckbox = $(this).closest('.item').siblings().find('.child')
              ;
            $childCheckbox.checkbox('set enabled');
          },
          // disable all children
          onUnchecked: function () {
            var
              $childCheckbox = $(this).closest('.item').siblings().find('.child')
              ;
            $childCheckbox.checkbox('set disabled');
          }
        })
        ;
    },
    bindButtons: function () {
      $nextBoxButton.on('click', handler.getNextBoxContentAndFill);
      $previousBoxButton.on('click', handler.getPreviousBoxContentAndFill);
      $downloadBoxFileButton.on('click', handler.download.file.bind(handler.download, 'box'));
      $downloadGroundTruthFileButton.on('click', handler.download.file.bind(handler.download, 'ground-truth'));
      $invisiblesToggleButton.on('click', handler.toggleInvisibles);
      $regenerateTextSuggestionForSelectedBoxButton.on('click', handler.generate.textSuggestion);
      $redetectAllBoxesButton.on('click', handler.generate.initialBoxes);
      $regenerateTextSuggestionsButton.on('click', handler.generate.textSuggestions);
      $settingsButton.on('click', handler.open.settingsModal);
      $settingsButtonForHelpPane.on('click', handler.open.settingsModal.bind(handler.open, 'help-section'));
      $resetButton.on('click', handler.resetAppSettings);
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
      handler.load.dropdowns();
      handler.load.popups();
      handler.load.settings();
      handler.create.defaultHighlighterTable();
      handler.create.defaultKeyboardShortcutsTable();
      handler.load.eventListeners();

      handler.saveHighlightsToSettings();
      handler.saveKeyboardShortcutsToSettings();

      handler.delete.expiredNotifications();
    },
  };

  availableShortcutActions = [
    {
      // target: $window,
      icon: 'arrow right',
      name: 'Move to next box',
      action: handler.getNextBoxContentAndFill,
    },
    {
      // target: $window,
      icon: 'arrow left',
      name: 'Move to previous box',
      action: handler.getPreviousBoxContentAndFill,
    },
  ],

    app.handler = handler;

  // Start the Magic
  await app.handler.initialize();

};

// attach ready event
$(document).ready(app.ready);
