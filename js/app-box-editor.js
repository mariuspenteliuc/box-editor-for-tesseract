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
app.ready = async () => {

  // selector cache
  var
    $document = $(document),
    $window = $(window),
    $html = $('html'),
    $body = $('body'),
    $highlighterLabels = $('#highlighters-labels'),
    $invisiblesToggleButton = $('#invisiblesToggle.ui.button'),
    $redetectAllBoxesButton = $('#redetectAllBoxes'),
    $regenerateTextSuggestionsButton = $('#regenerateTextSuggestions'),
    $regenerateTextSuggestionForSelectedBoxButton = $('#regenerateTextSuggestionForSelectedBox'),
    $appLanguageDropdownInSettings = $('#appLanguageDropdownInSettings'),
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
    $tooltipTriggers = $('.tooltip-trigger'),
    $boxFileInput = $('#boxFile'),
    $imageFileInput = $('#imageFile'),
    $imageFileInputButton = $('#imageFileButton'),
    $downloadBoxFileButton = $('#downloadBoxFileButton'),
    $downloadGroundTruthFileButton = $('#downloadGroundTruthButton'),
    $previousBoxButton = $('#previousBB'),
    $nextBoxButton = $('#nextBB'),
    $groundTruthColorizedOutput = $('#myInputBackground'),
    $previewColorizedOutput = $('#myPreviewBackground'),
    $taggingSegment = $('#taggingSegment'),
    $positionSlider = $('#positionSlider'),
    $progressSlider = $('#progressIndicator'),
    $virtualKeyboard = $('#virtualKeyboard'),
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
    $modelConfidenceScoreEnabledCheckbox = $(`input[name='interface.editorTools.confidenceScoreEnabled']`),
    $unsavedChangesBadge = $('#unsavedChanges'),
    $appInfoVersion = $('#appInfoVersion'),
    $appInfoUpdated = $('#appInfoUpdated'),
    $imageViewHeightSlider = $('#imageViewHeightSlider'),
    $balancedText = $('.balance-text, p, .header'),
    $toolbar = $('#custom-controls'),

    // variables
    pressedModifiers = {},
    _URL = window.URL || window.webkitURL,
    bounds,
    BoxFileType = Object.freeze({
      'WORDSTR': 1,
      'WORDSTR_PATTERN': /^WordStr(?:\s+[\d]+?\b){4}\s+[\d]+\s+#[\w\W]+?$\n^\t(?:\s+[\d]+?\b){4}\s+[\d]+\s*\n?/gm,
      'CHAR_OR_LINE': 2,
      'CHAR_OR_LINE_PATTERN': /^.+?\s+(?:[\d]+?\s+\b){4}[\d]+$\n?/gm,
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
      isDirty: () => boxDataInfo.dirty,
      setDirty: (value = true) => {
        boxDataInfo.dirty = value;
        $unsavedChangesBadge.toggle(boxDataInfo.dirty);
      }
    },
    lineDataInfo = {
      dirty: false,
      isDirty: () => lineDataInfo.dirty,
      setDirty: (value = true) => lineDataInfo.dirty = value,
    },
    unicodeData,
    imageFile,
    boxFile,
    imageFileInfo = {
      processed: false,
      isProcessed: () => this.processed,
      setProcessed: () => this.processed = true,
      setUnprocessed: () => this.processed = false,
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
    suppressLogMessages = { 'recognizing text': false, },
    worker,
    virtualKeyboard,
    virtualKeyboardBackspacePressed = false,

    appSettings = {
      localStorageKey: 'appSettings-boxEditor',
      appVersion: null,
      interface: {
        appLanguage: 'system-lang',
        appearance: 'match-device',
        toolbarActions: {
          detectAllLines: true,
          detectSelectedBox: true,
          detectAllBoxes: true,
          invisiblesToggle: true,
          languageModelDropdown: true,
        },
        editorTools: {
          virtualKeyboard: false,
          progressIndicator: true,
          positionSlider: true,
          formCoordinateFields: true,
          unicodeInfoPopup: true,
          confidenceScoreEnabled: true,
        },
        imageView: 500,
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
          enableWarrningMessagesForOverwritingDirtyData: true,
        },
        workflow: {
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

    notificationTypes = {
      info: {
        fileDownloadedInfo: { title: 'notificationTypeFileDownloadedInfoTitle', type: 'fileDownloadedInfo' },
      },
      warning: {
        nothingToDownloadWarning: { title: 'notificationTypeNothingToDownloadWarningTitle', type: 'nothingToDownloadWarning', class: 'warning' },
        resetAppWarning: { title: 'notificationTypeResetAppWarningTitle', type: 'resetAppWarning', class: 'warning' },
        replacingTextWarning: { title: 'notificationTypeReplacingTextWarningTitle', type: 'replacingTextWarning', class: 'warning' },
        nameMismatchError: { title: 'notificationTypeNameMismatchErrorTitle', type: 'nameMismatchError', class: 'warning' },
        overridingUnsavedChangesWarning: { title: 'notificationTypeOverridingUnsavedChangesWarningTitle', type: 'overridingUnsavedChangesWarning', class: 'warning' },
        uncommittedChangesWarning: { title: 'notificationTypeUncommittedChangesWarningTitle', type: 'uncommittedChangesWarning', class: 'warning' },
        differentFileNameWarning: { title: 'notificationTypeDifferentFileNameWarningTitle', type: 'differentFileNameWarning', class: 'warning' },
      },
      error: {
        loadingTranslationsError: { title: 'notificationTypeLoadingTranslationsErrorTitle', type: 'loadingTranslationsError', class: 'error' },
        networkError: { title: 'notificationTypeNetworkErrorTitle', type: 'networkError', class: 'error' },
        identicalPatternNamesError: { title: 'notificationTypeIdenticalPatternNamesErrorTitle', type: 'identicalPatternNamesError', class: 'error' },
        invalidPatternsError: { title: 'notificationTypeInvalidPatternsErrorTitle', type: 'invalidPatternsError', class: 'error' },
        commitLineError: { title: 'notificationTypeCommitLineErrorTitle', type: 'commitLineError', class: 'error' },
        loadingLanguageModelError: { title: 'notificationTypeLoadingLanguageModelErrorTitle', type: 'loadingLanguageModelError', class: 'error' },
        invalidFileTypeError: { title: 'notificationTypeInvalidFileTypeErrorTitle', type: 'invalidFileTypeError', class: 'error' },
      },
    },

    virtualKeyboardLayouts = {
      rts: {
        default: [
          '{grave} „ 1 2 3 4 5 6 7 8 9 0 - = {backspace}',
          '{acute}  ш е р т у ꙋ і о п ъ ꙟ',
          '{kavyka} а с д ф г х ж к л ꚗ ꚏ ѫ',
          '{capslock}    ч в б н м , . {capslock}',
          '{altleft} {space} {altright}',
        ],
        shift: [
          '{grave} ” ! @ # $ % ^ & * ( ) _ + {backspace}',
          '{acute}  Ш Е Р Т У Ꙋ І О П Ъ Ꙟ',
          '{kavyka} А С Д Ф Г Х Ж К Л Ꚗ Ꚏ Ѫ',
          '{capslock}    Ч В Б Н М ; : {capslock}',
          '{altleft} {space} {altright}',
        ],
        alt: [
          '{grave} „ 1 2 3 4 5 6 7 8 9 0 - = {backspace}',
          '{acute} ц щ є   ꙇ ꙋ꙼ ꙇ꙼ ю  ь ',
          '{kavyka} ꙗ ѕ ԁ  џ  ј  ꙥ ; \' ѣ',
          '{capslock} з ԑ ӡ        {capslock}',
          '{altleft} {space} {altright}',
        ],
        'alt+shift': [
          '{grave} ” ! @ # $ % ^ & * ( ) _ + {backspace}',
          '{acute} Ц Щ Є   Ꙇ Ꙋ꙼ Ꙇ꙼ Ю  Ь ',
          '{kavyka} Ꙗ Ѕ Ԁ  Џ  Ј  Ꙥ : " Ѣ',
          '{capslock} З Ԑ Ӡ        {capslock}',
          '{altleft} {space} {altright}',
        ],
        grave: [
          '{grave} „ 1 2 3 4 5 6 7 8 9 0 - = {backspace}',
          '{acute}   ѐ є̀  у̀ ꙋ̀ ꙇ̀ о̀ ю̀  ',
          '{kavyka} а̀ ꙗ̀          ѫ̀',
          '{capslock}           {capslock}',
          '{altleft} {space} {altright}',
        ],
        'grave+shift': [
          '{grave} ” ! @ # $ % ^ & * ( ) _ + {backspace}',
          '{acute}   Ѐ Є̀  У̀ Ꙋ̀ Ꙇ̀ О̀ Ю̀  ',
          '{kavyka} А̀ Ꙗ̀          Ѫ̀',
          '{capslock}           {capslock}',
          '{altleft} {space} {altright}',
        ],
        acute: [
          '{grave} „ 1 2 3 4 5 6 7 8 9 0 - = {backspace}',
          '{acute}   е́ є́  у́ ꙋ́ ꙇ́ о́ ю́  ',
          '{kavyka} а́ ꙗ́          ѫ́',
          '{capslock}           {capslock}',
          '{altleft} {space} {altright}',
        ],
        'acute+shift': [
          '{grave} ” ! @ # $ % ^ & * ( ) _ + {backspace}',
          '{acute}   Е́ Є́  У́ Ꙋ́ Ꙇ́ О́ Ю́  ',
          '{kavyka} А́ Ꙗ́          Ѫ́',
          '{capslock}           {capslock}',
          '{altleft} {space} {altright}',
        ],
        kavyka: [
          '{grave} „ 1 2 3 4 5 6 7 8 9 0 - = {backspace}',
          '{acute}       ꙋ꙼ ꙇ꙼    ',
          '{kavyka}  ꙗ꙼          ',
          '{capslock}           {capslock}',
          '{altleft} {space} {altright}',
        ],
        'kavyka+shift': [
          '{grave} ” ! @ # $ % ^ & * ( ) _ + {backspace}',
          '{acute}       Ꙋ꙼ Ꙇ꙼    ',
          '{kavyka}  Ꙗ꙼          ',
          '{capslock}           {capslock}',
          '{altleft} {space} {altright}',
        ],
      },
    },
    appTranslations = {},

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
    getAppInfo: () => {
      // get details from ../../app-version.json
      appInfo = JSON.parse($.ajax({
        url: "../../app-version.json",
        async: false,
        dataType: "json"
      }).responseText);
      appInfo.appName = appInfo.name.replace(/[^\w\s]/gi, '');
      return appInfo;
    },
    compareVersions: (a, b) => compareVersions.compareVersions(a, b),
    bindColorizerOnInput: () => {
      $colorizedOutputForms
        .each(function () {
          $(this)
            .find('input')
            .bind('input', handler.update.colorizedBackground);
        });
    },
    colorizeText: async (text) => {
      if ('' === text) return '&nbsp;';
      text = text.normalize('NFD');
      var
        colorizedText = '',
        currentScript = '',
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
        const
          char = text.charAt(i),
          isCapital = char != char.toLowerCase(),
          charName = handler.getUnicodeInfo(char)[0].name;
        var
          foundHighlight = false;
        if (/COMBINING/.test(charName)) {
          currentSpan += char;
          continue;
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
          // TODO: replace strings with HTML templates
          spanClass = foundHighlight.color.toLowerCase() +
            (isCapital ? ' capital' : '') +
            ' text-highlighter';
          if (currentScript != spanClass) {
            if (currentSpan.length) {
              colorizedText += '</span>' + currentSpan;
            }
            if (/space/.test(spanClass)) {
              currentSpan = '<span class="' + spanClass + '">' + charSpace;
            } else {
              currentSpan = '<span class="' + spanClass + '">' + char;
            }
          } else {
            if (/space/.test(currentScript)) {
              if (!/multiple/.test(currentSpan)) {
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
          if (currentSpan.length) {
            colorizedText += '</span>' + currentSpan;
          }
          currentSpan = '<span class="' + spanClass + '">' + char;
          currentScript = spanClass;
        }
      }
      colorizedText += '</span>' + currentSpan;
      return colorizedText;
    },
    getHighlighters: () => {
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
    getUnicodeInfo: (string) => {
      var unicodeInfo = [];
      string = string.normalize('NFD');

      for (var i = 0; i < string.length; i++) {
        const
          char = string.charAt(i),
          code = char.charCodeAt(0),
          hex = code.toString(16).toUpperCase(),
          unicode = '0000'.substring(hex.length) + hex,
          result = handler.getUnicodeData(unicode);
        if (!unicodeInfo.find(x => x['code'] == result.code)) {
          unicodeInfo.push(result);
        }
      }
      return unicodeInfo;
    },
    getUnicodeData: (unicode) => {
      const result = unicodeData.find(x => x['code'] == unicode);
      result.char = String.fromCharCode(parseInt(unicode, 16));
      return result;
    },
    saveHighlightsToSettings: () => {
      if ($textHighlightingEnabledCheckbox[0].checked) {
        var
          patterns = [],
          errorMessages = [];
        invalidPatterns = false;
        $highlighterTableRows
          .each((_, elem) => {
            const
              enabled = elem.querySelector('td:nth-child(1) .checkbox input').checked,
              name = elem.querySelector('td:nth-child(2)').innerText,
              color = elem.querySelector('td:nth-child(3) input[name=color]').value,
              pattern = elem.querySelector('td:nth-child(4)').innerText;
            try {
              new RegExp(pattern, 'i');
              patterns.push({
                enabled: enabled,
                name: name,
                color: color,
                pattern: pattern,
              });
            } catch (error) {
              if (error instanceof SyntaxError) {
                handler.highlightCell(elem.querySelector('td:nth-child(4)'));
                errorMessages.push({ name, enabled, error });
              } else { throw error; }
            }
          });
        if (errorMessages.length) {
          errorMessages
            .forEach(object => {
              if (object.enabled) {
                console.warn(object.error.message + `: ${object.name}`);
                invalidPatterns = true;
              }
            });
        }
        const
          patternNames = patterns.map(pattern => pattern.name),
          patternNamesSet = [...new Set(patternNames)];
        identicalPatternNames = patternNames.length != patternNamesSet.length;
        appSettings.highlighter.textHighlighting.highlightsPatterns = patterns;
      }
      handler.update.colorizedBackground();
      handler.update.patternLabels();
      handler.update.localStorage();
    },
    saveKeyboardShortcutsToSettings: () => {
      if (appSettings.behavior.keyboardShortcuts.keyboardShortcutsEnabled) {
        var
          shortcuts = [],
          errorMessages = [];
        $keyboardShortcutsTableRows
          .each((_, elem) => {
            handler.unhighlightCell(elem.querySelector('td:nth-child(2)'));
            const
              enabled = elem.querySelector('td:nth-child(1) .checkbox input').checked,
              localizationKey = elem.querySelector('td:nth-child(2) input[name=action]').value,
              keyCombo = elem.querySelector('td:nth-child(3)').innerText,
              action = availableShortcutActions.find(action => action.localizationKey === localizationKey).action;
            try {
              shortcuts.push({
                enabled: enabled,
                keyCombo: keyCombo,
                localizationKey: localizationKey,
                action: action,
                // target: target,
              });
            } catch (error) {
              handler.highlightCell(elem.querySelector('td:nth-child(2)'));
              errorMessages.push({ keyCombo, enabled, error });
            }
          });

        shortcutKeys = shortcuts.map(shortcut => shortcut.keyCombo.toUpperCase());
        shortcutKeysSet = [...new Set(shortcutKeys)];
        duplicatedKeyboardShortcuts = shortcutKeys.length != shortcutKeysSet.length ? true : false;
        appSettings.behavior.keyboardShortcuts.shortcuts = shortcuts;
      }
      if (appSettings.behavior.keyboardShortcuts.shortcuts.length) {
        // add listener for keyboard shortcuts
        handler.load.keyboardShortcuts();
      }
      handler.update.localStorage();
    },
    highlightCell: elem => $(elem).addClass('red colored'),
    unhighlightCell: elem => $(elem).removeClass('red colored'),
    notifyUser: object => {
      if (!object.title) object.title = object.type.charAt(0).toUpperCase() + object.type.slice(1);
      if (!object.time) object.time = 'auto';
      if (!object.class) object.class = 'neutral';
      $.toast({
        title: appTranslations[object.title],
        class: object.class,
        displayTime: object.time,
        showProgress: 'top',
        position: 'top right',
        classProgress: object.color,
        message: appTranslations[object.message] || object.message,
        minDisplayTime: 3000,
        actions: object.actions ? object.actions : false,
      });
    },
    askUser: async object => {
      if (!object.message) return false;
      if (('differentFileNameWarning'.includes(object.type) && !appSettings.behavior.alerting.enableWarrningMessagesForDifferentFileNames) ||
        ('uncommittedChangesWarning'.includes(object.type) && !appSettings.behavior.alerting.enableWarrningMessagesForUncommittedChanges)) {
        return true;
      }
      handler.setKeyboardControl('prompt');
      if (object.actions == []) {
        object.actions = [{
          confirmText: appTranslations['askUserConfirmText'],
          confirmTextClass: 'green positive',
        }, {
          denyText: appTranslations['askUserDenyText'],
          denyTextClass: 'red negative',
        }];
      }
      return new Promise((resolve, reject) => {
        $.modal({
          // inverted: true,
          // blurring: true,
          title: appTranslations[object.title],
          // closeIcon: true,
          // autofocus: true,
          // restoreFocus: true,
          onApprove: () => {
            resolve(true);
          },
          onDeny: () => {
            resolve(false);
          },
          onHide: () => {
            handler.setKeyboardControl('form');
            resolve(false);
          },
          content: appTranslations[object.message] || object.message,
          actions: object.actions,
        }).modal('show');
      });
    },
    clearLocalStorage: (loadingError = true) => {
      localStorage.removeItem(appSettings.localStorageKey);
      if (loadingError) {
        localStorage.removeItem('loading-error');
      }
      location.reload();
    },
    resetAppSettings: async () => {
      const response = await handler.askUser({
        title: notificationTypes.warning.resetAppWarning.title,
        message: 'notificationTypeResetAppWarningBody',
        type: notificationTypes.warning.resetAppWarning.type,
        actions: [{
          text: appTranslations['askUserCancelText'],
          class: 'cancel',
        }, {
          text: appTranslations['askUserResetText'],
          class: 'red ok',
        }]
      });
      if (response) {
        handler.clearLocalStorage();
      }
    },
    testFunction: fn => fn(),
    keyboardShortcuts: {
      getKeys: () => {
        return appSettings.keyboardShortcuts;
      },
      register: () => {
        handler.keyboardShortcuts.setUpPreview();

        // $document[0].addEventListener('keydown', handler.keyboardShortcuts.handleKeyDown);
        // $document[0].addEventListener('keyup', handler.keyboardShortcuts.handleKeyUp);

        handler.keyboardShortcuts.updatePreview();
      },
      has: key => appSettings.keyboardShortcuts.hasOwnProperty(key),
      handleKeyDown: event => {
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
            title: appTranslations['notificationTypeShortcutExistsWarningTitle'],
            message: appTranslations['notificationTypeShortcutExistsWarningBody']
              .replace('${key}', `${key}`),
            type: 'warning',
          })
          return;
        }

        handler.keyboardShortcuts.add(key);
        handler.keyboardShortcuts.updatePreview();

      },
      add: key => {
        appSettings.keyboardShortcuts[key] = key;
      },
      handleKeyUp: event => {
        if (handler.keyboardShortcuts.isModifierKey(event.key)) {
          pressedModifiers[event.key] = false;
        }
        // console.log(pressedModifiers);
      },
      isNavigationKey: key => {
        navigationKeys = ['Tab', 'ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'];
        return navigationKeys.includes(key) ? true : false;
      },
      isModifierKey: key => {
        modifiers = ['Alt', 'Shift', 'Control', 'Meta'];
        return modifiers.includes(key) ? true : false;
      },
      setUpPreview: () => { },
      updatePreview: () => {
        console.log(handler.keyboardShortcuts.getKeys());
      },
    },
    setKeyboardControl: context => {
      switch (context) {
        case 'prompt':
          $window.off('keydown');
          break;
        case 'form':
          handler.load.keyboardShortcuts();
          break;
        case 'settings':
          // $window.off('keydown');
          break;
        default:
          break;
      }
    },
    delete: {
      box: box => {
        const boxIndex = boxData.findIndex(object => object.equals(box));
        if (boxIndex > -1) {
          boxData.splice(boxIndex, 1);
        }
        const
          newIndex = recognizedLinesOfText.findIndex(object => {
            object = object.bbox;
            const newBox = new Box({
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
      expiredNotifications: () => {
        const currentDate = new Date();

        $('.updateNotification')
          .each(() => {
            const
              releaseDate = new Date($(this).attr('data-release-date')),
              removeDays = parseInt($(this).attr('data-expire-notification')),
              timeDifference = currentDate - releaseDate,
              daysDifference = timeDifference / (1000 * 60 * 60 * 24),
              parent = $(this)[0].parentElement;

            if (daysDifference >= removeDays) {
              try {
                console.info(`Notification badge removed from: ${parent.attributes['id']}, ${parent.attributes['class'].textContent}, ${parent.outerHTML}`)
                $(this).remove();
              } catch (error) {
                console.error(error);
              }
            }
          });
      },
    },
    create: {
      keyboardShortcutsTable: async () => {
        const
          table = document.createElement('table'),
          thead = document.createElement('thead'),
          theadRow = document.createElement('tr'),
          headers = [
            appTranslations['keyboardShortcutsTableHeaderEnabled'],
            appTranslations['keyboardShortcutsTableHeaderAction'],
            appTranslations['keyboardShortcutsTableHeaderKeyCombo'],
            appTranslations['keyboardShortcutsTableHeaderDeleteButton']
          ],
          tbody = document.createElement('tbody'),
          localStorageValue = localStorage.getItem(appSettings.localStorageKey);
        table.className = 'ui unstackable celled table';
        thead.appendChild(theadRow);
        for (const header of headers) {
          const th = document.createElement('th');
          th.className = header ? '' : 'collapsing';
          th.className = header === appTranslations['keyboardShortcutsTableHeaderKeyCombo'] ? 'eight wide' : '';
          th.className = header === appTranslations['keyboardShortcutsTableHeaderAction'] ? 'eight wide' : '';
          th.textContent = header;
          theadRow.appendChild(th);
        }

        try {
          const localStorageSettings = JSON.parse(localStorageValue);
          const shortcuts = localStorageSettings?.behavior?.keyboardShortcuts?.shortcuts;
          shortcuts.forEach(shortcut => {
            const row = handler.create.keyboardShortcutRow(shortcut.enabled, shortcut.keyCombo, shortcut.localizationKey);
            tbody.appendChild(row);
          });

          if (!localStorageValue || shortcuts.length == 0) {
            const rows = [
              { enabled: true, keyCombo: 'ENTER', localizationKey: 'keyboardShortcutsTableMoveToNextBox' },
              { enabled: true, keyCombo: 'Shift + ENTER', localizationKey: 'keyboardShortcutsTableMoveToPreviousBox' },
            ];
            rows.forEach(row => {
              const rowElement = handler.create.keyboardShortcutRow(row.enabled, row.keyCombo, row.localizationKey);
              tbody.appendChild(rowElement);
            });
          }
        } catch (error) {
          console.error(error);
        }

        table.appendChild(thead);
        table.appendChild(tbody);

        $keyboardShortcutsTableContainer[0].insertBefore(table, $keyboardShortcutsTableContainer[0].firstChild);

        $keyboardShortcutsTableBody = $keyboardShortcutsTableContainer.find('.ui.celled.table tbody');
        $keyboardShortcutsTableRows = $keyboardShortcutsTableBody.find('tr');

        return table;
      },
      highlighterTable: async () => {
        const
          table = document.createElement('table'),
          thead = document.createElement('thead'),
          theadRow = document.createElement('tr'),
          headers = [
            appTranslations['highlighterTableHeaderEnabled'],
            appTranslations['highlighterTableHeaderName'],
            appTranslations['highlighterTableHeaderColor'],
            appTranslations['highlighterTableHeaderPattern'],
            appTranslations['highlighterTableHeaderDeleteButton']
          ],
          tbody = document.createElement('tbody'),
          localStorageValue = localStorage.getItem(appSettings.localStorageKey);
        table.className = 'ui unstackable celled table';
        thead.appendChild(theadRow);
        for (const header of headers) {
          const th = document.createElement('th');
          th.className = header ? '' : 'collapsing';
          th.className = header === appTranslations['highlighterTableHeaderColor'] ? 'four wide' : '';
          th.textContent = header;
          theadRow.appendChild(th);
        }

        const localStorageSettings = JSON.parse(localStorageValue);
        const highlights = localStorageSettings?.highlighter.textHighlighting?.highlightsPatterns;
        highlights.forEach(highlight => {
          const row = handler.create.highlighterRow(highlight.enabled, highlight.name, highlight.color, highlight.pattern);
          tbody.appendChild(row);
        });

        if (!highlights || highlights.length == 0) {
          const rows = [
            { enabled: true, name: 'Latin', color: 'blue', pattern: '[\\u0000-\\u007F\\u0080-\\u00FF]' },
            { enabled: true, name: 'Cyrillic', color: 'yellow', pattern: '[\\u0400-\\u04FF\\u0500-\\u052F\\u2DE0-\\u2DFF\\uA640-\\uA69F\\u1C80-\\u1CBF]' },
            { enabled: true, name: 'Digits', color: 'red', pattern: '[0-9]' },
          ];
          rows.forEach(row => {
            const rowElement = handler.create.highlighterRow(row.enabled, row.name, row.color, row.pattern);
            tbody.appendChild(rowElement);
          });
        }
        table.appendChild(thead);
        table.appendChild(tbody);

        $highlighterTableContainer[0].insertBefore(table, $highlighterTableContainer[0].firstChild);

        $highlighterTableBody = $highlighterTableContainer.find('.ui.celled.table tbody');
        $highlighterTableRows = $highlighterTableBody.find('tr');

        return table;
      },
      infoPopupContent: (objects) => {
        const
          grid = document.createElement('div'),
          row = document.createElement('div'),
          leftColumn = document.createElement('div'),
          rightColumn = document.createElement('div'),
          leftHeader = document.createElement('b'),
          rightHeader = document.createElement('b');

        grid.classList.add('ui', 'compact', 'grid');
        grid.style.maxHeight = '30rem';
        grid.style.overflowY = 'auto';
        row.classList.add('two', 'column', 'stretched', 'row');
        leftColumn.classList.add('twelve', 'wide', 'left', 'floated', 'column');
        rightColumn.classList.add('four', 'wide', 'right', 'floated', 'column', 'text', 'right', 'aligned');
        leftHeader.textContent = appTranslations['tooltipUnicodeInfoNameColumn'];
        rightHeader.textContent = appTranslations['tooltipUnicodeInfoCharColumn'];

        leftColumn.appendChild(leftHeader);
        rightColumn.appendChild(rightHeader);
        row.appendChild(leftColumn);
        row.appendChild(rightColumn);
        grid.appendChild(row);

        objects.forEach((object) => {
          const
            newRow = document.createElement('div'),
            leftContent = document.createElement('div'),
            rightContent = document.createElement('div');
          newRow.classList.add('two', 'column', 'stretched', 'row');
          newRow.style.zIndex = 1903;
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
      highlighterRow: (enabled, name, color, pattern) => {
        const
          row = document.createElement('tr'),
          checkboxCell = handler.create.checkboxCell(name, enabled, { onChange: handler.saveHighlightsToSettings }),
          nameCell = handler.create.editableTextCell(name, { onChange: handler.saveHighlightsToSettings }),
          colorCell = handler.create.colorCell(color, { onChange: handler.saveHighlightsToSettings }),
          patternCell = handler.create.editableTextCell(pattern, { onChange: handler.saveHighlightsToSettings }),
          actionsCell = handler.create.actionsCell({ onClick: handler.saveHighlightsToSettings });
        row.appendChild(checkboxCell);
        row.appendChild(nameCell);
        row.appendChild(colorCell);
        row.appendChild(patternCell);
        row.appendChild(actionsCell);

        return row;
      },
      keyboardShortcutRow: (enabled, keyCombo, localizationKey) => {
        const
          row = document.createElement('tr'),
          checkboxCell = handler.create.checkboxCell(keyCombo, enabled, { onChange: handler.saveKeyboardShortcutsToSettings }),
          shortcutsActionCell = handler.create.shortcutActionCell(localizationKey, { onChange: handler.saveKeyboardShortcutsToSettings }),
          keyComboCell = handler.create.editableTextCell(keyCombo, { onChange: handler.saveKeyboardShortcutsToSettings }),
          actionsCell = handler.create.actionsCell({ onChange: handler.saveKeyboardShortcutsToSettings });
        row.appendChild(checkboxCell);
        row.appendChild(shortcutsActionCell);
        row.appendChild(keyComboCell);
        row.appendChild(actionsCell);

        return row;
      },
      checkboxCell: (name, enabled, params = {}) => {
        const
          cell = document.createElement('td'),
          div = document.createElement('div'),
          input = document.createElement('input');
        cell.setAttribute('data-label', 'Enabled');
        div.className = 'ui fitted checkbox text-highlighter-checkbox';
        input.type = 'checkbox';
        input.name = name;
        input.checked = enabled;

        div.appendChild(input);
        $(div).checkbox({
          onChange: () => {
            params.onChange();
          },
        });
        cell.appendChild(div);
        return cell;
      },
      editableTextCell: (name, params = {}) => {
        const
          cell = document.createElement('td');
        cell.contentEditable = true;
        cell.innerText = name;
        $(cell).on('input', params.onChange);
        return cell;
      },
      colorCell: (color, params = {}) => {
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
        colors.forEach(color => {
          const
            itemDiv = document.createElement('div'),
            colorIcon = document.createElement('i'),
            colorText = document.createElement('span');
          itemDiv.className = 'item';
          itemDiv.setAttribute('data-value', color);
          colorIcon.className = `ui ${color} small empty circular label icon link text-highlighter`;
          colorText.textContent = appTranslations[color].charAt(0).toUpperCase() + appTranslations[color].slice(1);
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
      shortcutActionCell: (action, params = {}) => {
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
        availableShortcutActions.forEach(action => {
          const
            itemDiv = document.createElement('div'),
            actionIcon = document.createElement('i'),
            actionText = document.createElement('span');
          itemDiv.className = 'item';
          itemDiv.setAttribute('data-value', action.localizationKey);
          actionIcon.className = `ui small ${action.icon} icon`;
          actionText.textContent = appTranslations[action.localizationKey];
          actionText.setAttribute('localization-key', action.localizationKey);
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
      actionsCell: (params = {}) => {
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
          params.onClick();
        });
        actionCell.appendChild(deleteButton);
        return actionCell;
      },
      map: (name) => {
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

        const
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

        map.on('draw:deleted', (e) => {
          Object.keys(e.layers._layers)
            .forEach(element => {
              const
                polyid = parseInt(element),
                delbox = boxData.find(box => box.polyid == polyid),
                delindex = handler.delete.box(delbox);
            });
          handler.update.progressBar({ type: 'tagging' });
        });
        map.on('draw:deletestart', async event => mapState = 'deleting');
        map.on('draw:deletestop', async (event) => {
          mapState = null;
          handler.update.slider({ max: boxData.length });
        });
        map.on('draw:drawstart', async event => mapState = 'editing');
        map.on('draw:drawstop', async event => mapState = null);
        map.on(L.Draw.Event.CREATED, async (event) => {
          switch (event.layerType) {
            case 'rectangle':
              await handler.create.rectangle(event.layer);
              break;
            case 'polyline':
              await handler.create.polyline(event.layer);
              break;

            default:
              break;
          }
          handler.focusBoxID(selectedPoly._leaflet_id);
        });
      },
      rectangle: layer => {
        layer.on('edit', handler.editRectangle);
        layer.on('click', handler.selectRectangle);
        handler.style.setActive(layer);
        boxLayer.addLayer(layer);
        const
          polyid = boxLayer.getLayerId(layer),
          newBox = new Box({
            polyid: polyid,
            text: '',
            x1: Math.round(layer._latlngs[0][0].lng),
            y1: Math.round(layer._latlngs[0][0].lat),
            x2: Math.round(layer._latlngs[0][2].lng),
            y2: Math.round(layer._latlngs[0][2].lat)
          });
        idx = selectedBox ? boxData.findIndex(x => x.equals(selectedBox)) : 0;
        boxData.splice(idx + 1, 0, newBox);
        handler.sortAllBoxes();
        handler.init.slider();
        map.addLayer(boxLayer);
        handler.focusBoxID(polyid);
      },
      polyline: async (poly) => {
        handler.set.loadingState({ main: true, buttons: true });
        var
          polyBounds = poly.getBounds(),
          newSelectedPoly = null,
          newBoxes = [],
          deleteBoxes = [];
        for (var i = 0; i < boxData.length; i++) {
          const
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
          .forEach(box => {
            const layer = boxLayer.getLayer(box.polyid);
            boxLayer.removeLayer(layer);
            boxData.splice(boxData.indexOf(box), 1);
            handler.delete.box(box);
          });

        newBoxes = newBoxes.map(box => new Box(box));

        newBoxes
          .forEach(newBox => {
            const newPoly = L.rectangle([[newBox.y1, newBox.x1], [newBox.y2, newBox.x2]]);
            newPoly.on('edit', handler.editRectangle);
            newPoly.on('click', handler.selectRectangle);
            handler.style.remove(newPoly);
            boxLayer.addLayer(newPoly);
            const polyid = boxLayer.getLayerId(newPoly);
            newBox.polyid = polyid;
            boxData.push(newBox);
          });

        await handler.ocr.detect(newBoxes);
        handler.sortAllBoxes();
        handler.set.loadingState({ main: false, buttons: false });
        handler.update.progressBar({ type: 'tagging' });
        handler.update.slider({ max: true });
        if (newSelectedPoly) {
          handler.focusBoxID(boxData.find(x =>
            x.x1 == newSelectedPoly.x1 &&
            x.x2 == newSelectedPoly.x2 &&
            x.y1 == newSelectedPoly.y1 &&
            x.y2 == newSelectedPoly.y2
          ).polyid);
        }
      },
    },
    addNewHighlighterPattern: () => {
      const
        tableBody = $highlighterTableBody[0],
        row = handler.create.highlighterRow(true, appTranslations['highlighterTableDefaultName'], false, '.');
      tableBody.append(row);
      // update selectors
      $highlighterTableBody = $highlighterTableContainer.find('.ui.celled.table tbody');
      $highlighterTableRows = $highlighterTableBody.find('tr');
      handler.saveHighlightsToSettings();
    },
    sortAllBoxes: () => boxData.sort(Box.compare),
    editRectangle: async (event) => {
      const
        layer = event.target,
        box = boxData.find(x => x.polyid == layer._leaflet_id),
        newBox = new Box({
          text: lineDataInfo.isDirty() ? $groundTruthInputField.val() : box.text,
          x1: Math.round(layer._latlngs[0][0].lng),
          y1: Math.round(layer._latlngs[0][0].lat),
          x2: Math.round(layer._latlngs[0][2].lng),
          y2: Math.round(layer._latlngs[0][2].lat),
        });
      await handler.update.boxData(layer._leaflet_id, newBox);
      await handler.update.form(newBox);
      handler.sortAllBoxes();
    },
    selectRectangle: (event) => {
      if (event.target.editing.enabled() || 'deleting'.includes(mapState)) return;
      const shape = event.target;
      handler.style.remove(selectedPoly);
      handler.map.disableEditBox(selectedPoly);
      handler.focusBoxID(shape._leaflet_id);
      handler.map.enableEditBox(shape);
      handler.sortAllBoxes();
    },
    cutBoxByPoly: (box, poly) => {
      const
        polyFeature = turf.lineString(poly),
        boxFeature = turf.bboxPolygon([box.x1, box.y1, box.x2, box.y2]);
      var splitLines = [];

      for (var i = 0; i < poly._latlngs.length - 1; i++) {
        var
          segmentPoints = [[poly._latlngs[i].lng, poly._latlngs[i].lat], [poly._latlngs[i + 1].lng, poly._latlngs[i + 1].lat]],
          j = i + 1;
        while (turf.booleanPointInPolygon([poly._latlngs[j].lng, poly._latlngs[j].lat], boxFeature) && j < poly._latlngs.length - 1) {
          j++;
          segmentPoints.push([poly._latlngs[j].lng, poly._latlngs[j].lat]);
        }
        const segmentFeature = turf.lineString(segmentPoints);
        splitLines.push(segmentFeature);
        i = j - 1;
      }

      var intersectingLines = [];
      splitLines.forEach(line => {
        if (turf.booleanIntersects(line, boxFeature)) {
          intersectingLines.push(line);
        }
      });

      var boxGaps = [];
      intersectingLines.forEach(line => {
        boxGaps.push(turf.envelope(line));
      });

      var
        newBoxes = [],
        newEdges = [];
      newEdges.push(box.x1);
      boxGaps.forEach(gap => {
        newEdges.push(gap.geometry.coordinates[0][0][0]);
        newEdges.push(gap.geometry.coordinates[0][2][0]);
      });
      newEdges.push(box.x2);

      newEdges.sort((a, b) => a - b);

      for (var i = 0; i < newEdges.length - 1; i += 2) {
        const newBox = {
          x1: newEdges[i],
          y1: box.y1,
          x2: newEdges[i + 1],
          y2: box.y2
        };
        newBoxes.push(newBox);
      }

      newBoxes.forEach(element => {
        element.x1 = Math.round(element.x1);
        element.y1 = Math.round(element.y1);
        element.x2 = Math.round(element.x2);
        element.y2 = Math.round(element.y2);
      });

      return newBoxes;
    },
    virtualKeyboardKeyPressed: key => {
      console.log("Button pressed", key);
      virtualKeyboard.removeButtonTheme(key, 'active')
      let
        currentLayout = virtualKeyboard.options.layoutName,
        alternativeLayouts = ['grave', 'acute', 'kavyka', 'alt'],
        keysDic = {
          'grave': '{grave}',
          'acute': '{acute}',
          'kavyka': '{kavyka}',
          'alt': '{altleft} {altright} {optionleft} {optionright} {alt} {option}',
          'shift': '{shiftleft} {shiftright} {shift} {capslock}',
        }
      var
        newLayout = '',
        keys = '';

      switch (key) {
        case '{backspace}':
        case '{bksp}':
          virtualKeyboardBackspacePressed = true;
          return false;
          break;
        case '{shiftleft}':
        case '{shiftright}':
        case '{capslock}':
          newLayout = 'shift';
          keys = '{shiftleft} {shiftright} {capslock}';
          virtualKeyboard.addButtonTheme(keys, "ui active button")
          break;
        case '{altleft}':
        case '{altright}':
        case '{optionleft}':
        case '{optionright}':
          newLayout = 'alt';
          keys = '{altleft} {altright} {optionleft} {optionright}';
          virtualKeyboard.addButtonTheme(keys, "ui active button")
          break;
        case '{cyrillic}':
          newLayout = 'cyrillic';
          break;
        case '{latin}':
          newLayout = 'latin';
          break;
        case '{grave}':
          newLayout = 'grave';
          keys = '{grave}';
          virtualKeyboard.addButtonTheme(keys, "ui active button")
          break;
        case '{acute}':
          newLayout = 'acute';
          keys = '{acute}';
          virtualKeyboard.addButtonTheme(keys, "ui active button")
          break;
        case '{kavyka}':
          newLayout = 'kavyka';
          keys = '{kavyka}';
          virtualKeyboard.addButtonTheme(keys, "ui active button")
          break;

        default:
          return false;
          break;
      }

      if (currentLayout.includes('+')) {
        if (currentLayout.includes(newLayout)) {
          // remove current layout from string
          newLayout = currentLayout.replace(newLayout, '').replace('+', '');
          virtualKeyboard.removeButtonTheme(keys, 'active');
        } else {
          // retrieve other layout from string
          const otherLayout = currentLayout.split('+').find(layout => layout !== alternativeLayouts.find(accent => newLayout === accent));
          // virtualKeyboard.removeButtonTheme('{'+otherLayout+'}', 'active');
          virtualKeyboard.removeButtonTheme(keysDic[otherLayout], 'active');
          newLayout = [newLayout, currentLayout.split('+')[1]].join('+');
        }
      } else {
        // if (alternativeLayouts.includes(currentLayout)) {
        // virtualKeyboard.removeButtonTheme(currentLayout, 'active');
        // } else {

        // }


        if (!alternativeLayouts.includes(currentLayout)) {
          if (currentLayout !== 'default' && currentLayout !== newLayout) {
            // if (!alternativeLayouts.includes(newLayout)) {
            //   // sort layouts alphabetically
            //   newLayout = [newLayout, currentLayout].sort((a, b) => a.localeCompare(b)).join('+');
            //   // newLayout = [newLayout, currentLayout].join('+');
            // } else {
            newLayout = [newLayout, currentLayout].join('+');
            // }
          } else {
            // newLayout = 'default';
          }
        } else {
          if (alternativeLayouts.includes(newLayout))
            // virtualKeyboard.removeButtonTheme('{' + currentLayout + '}', 'active');
            virtualKeyboard.removeButtonTheme(keysDic[currentLayout], 'active');
          else
            newLayout = [currentLayout, newLayout].join('+');
        }
      }


      let toggle = currentLayout === newLayout ? 'default' : newLayout;
      if (toggle === 'default') virtualKeyboard.removeButtonTheme(keys, 'active')
      virtualKeyboard.setOptions({
        layoutName: toggle
      });
    },
    set: {
      virtualKeyboardInput: text => {
        virtualKeyboard.setInput(text);
      },
      virtualKeyboardLayout: layout => {
        virtualKeyboard.setOptions({
          layout: virtualKeyboardLayouts[layout]
        });
      },
      mapResize: async (height, animate) => {
        // TODO: refresh jquery selector. It does not work even though it shoud.
        // $map[0].animate({ height: height }, animate ? 500 : 0);
        $('#mapid').animate({ height: height }, animate ? 500 : 0);
        await handler.map.invalidateSize();
      },
      mapSize: async (options, animate = true) => {
        await handler.set.mapResize(options.height, animate);
        selectedPoly?.getBounds().extend(selectedPoly.getBounds());
      },
      appAppearance: (value) => {
        const docClassesRef = $document[0].documentElement.classList;
        docClassesRef.remove(...docClassesRef);
        docClassesRef.toggle(value);
        value = value.replaceAll('-theme', '');
        handler.set.sourceMediaTheme(value);
      },
      sourceMediaTheme: function (colorPreference) {
        const pictures = document.querySelectorAll('picture')

        pictures.forEach((picture) => {
          const sources =
            picture.querySelectorAll(`
        source[media*="prefers-color-scheme"],
        source[data-media*="prefers-color-scheme"]
      `)

          sources.forEach((source) => {
            if (source?.media.includes('prefers-color-scheme')) {
              source.dataset.media = source.media
            }
            if ('match-device' === colorPreference) {
              source.media = '(prefers-color-scheme: dark)'
            } else if (source?.dataset.media.includes(colorPreference)) {
              source.media = 'all'
            } else if (source) {
              source.media = 'none'
            }
          })
        })
      },
      loadingState: (object) => {
        if (object.main != undefined) {
          if (object.main) {
            $map.addClass('loading disabled');
            $progressSlider.addClass('disabled');
            $positionSlider.addClass('disabled');
            $virtualKeyboard.find('.button')
              .filter((index, element) => $(element).attr('data-skbtn') !== '')
              .addClass('disabled'); if (image != undefined) {
                $(image._image).animate({ opacity: 0.3 }, 200);
              }
          } else {
            $map.removeClass('loading disabled');
            $progressSlider.removeClass('disabled');
            $positionSlider.removeClass('disabled');
            $virtualKeyboard.find('.button')
              .filter((index, element) => $(element).attr('data-skbtn') !== '')
              .removeClass('disabled');
            if (image != undefined) {
              $(image._image).animate({ opacity: 1 }, 500);
            }
          }
        }
        if (object.buttons != undefined) {
          if (object.buttons) {
            $fields
              .each((_, elem) => $(elem)
                .prop('disabled', true)
                .addClass('disabled')
              );
            $buttons
              .each((_, elem) => $(elem)
                .prop('disabled', true)
                .addClass('disabled')
              );
          } else {
            $fields
              .each((_, elem) => $(elem)
                .prop('disabled', false)
                .removeClass('disabled')
              );
            $buttons
              .each((_, elem) => $(elem)
                .prop('disabled', false)
                .removeClass('disabled')
              );
          }
        }
      },
    },
    translatePage: () => {
      document.querySelectorAll('[localization-key]')
        .forEach(element => {
          let
            key = element.getAttribute('localization-key'),
            translation = appTranslations[key];
          element.innerText = translation;
        })
    },
    update: {
      interfaceLanguage: async (lang) => {
        await handler.load.translations(lang);//.then(translationData => {
        // Use the translation data as needed
        //   appTranslations = translationData;
        //   appSettings.interface.appLanguage = languageToUse;
        //   console.info('loaded', appTranslations['locale'], appSettings.interface.appLanguage);
        // }).catch(error => {
        //   console.error('Error loading translation:', error);
        // });;
        await handler.translatePage();
        await handler.load.sliders();
        handler.load.virtualKeyboard();
        if (selectedBox) handler.update.confidenceScoreField(selectedBox);
      },
      settingsModal: async () => {
        // Toolbar Actions
        if (Object.values(appSettings.interface.toolbarActions).every(value => !value)) {
          $toolbar.toggle(false);
        } else {
          $toolbar.toggle(true);
          for (const [key, value] of Object.entries(appSettings.interface.toolbarActions)) {
            const path = 'interface.toolbarActions.' + key;
            const checkbox = $checkboxes.find(`input[name="${path}"]`);
            checkbox.prop('checked', value);
            $('#custom-controls [name="' + path + '"]').toggle(appSettings.interface.toolbarActions[key]);
          }
        }
        // App Language Dropdown
        handler.load.translations(appSettings.interface.appLanguage);
        // $appLanguageDropdownInSettings.dropdown('set selected', appSettings.interface.appLanguage, true);
        // Appearance
        const appearancePath = 'interface.appearance';
        document.querySelector(`input[name='${appearancePath}'][value='${appSettings.interface.appearance}']`).checked = true;
        handler.set.appAppearance(appSettings.interface.appearance);
        // Image View
        const imageViewPath = 'interface.imageView';
        $imageViewHeightSlider.slider('set value', appSettings.interface.imageView, fireChange = false);
        if (appSettings.interface.imageView < 300) {
          // find item with text 'Tiny'
          $imageViewHeightSlider.find('.label').each(() => {
            if (appTranslations['settingsMenuImageViewSliderLabelTiny'] == this.innerText) {
              // append span element with additional text
              this.innerHTML += '<span class="ui italic grey text">&nbsp;– ' + appTranslations['settingsMenuImageViewSliderClippingWarning'] + '</span>';
            }
          });
        }
        handler.set.mapSize({ height: appSettings.interface.imageView });
        // Editor Tools
        const editorToolsPath = 'interface.editorTools';
        for (const [key, value] of Object.entries(appSettings.interface.editorTools)) {
          const path = 'interface.editorTools.' + key;
          const checkbox = $checkboxes.find(`input[name="${path}"]`);
          checkbox.prop('checked', value);
          $('#' + key).toggle(appSettings.interface.editorTools[key]);
          document.querySelector(`input[name='${path}']`).checked = value;
        }
        // On Image Load
        for (const [key, value] of Object.entries(appSettings.behavior.onImageLoad)) {
          const path = 'behavior.onImageLoad.' + key;
          document.querySelector(`input[name='${path}']`).checked = value;
          if ('detectAllLines'.includes(key) && !value) {
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
          document.querySelector(`input[name='${path}']`).checked = value;
        }
        // Keyboard Shortcuts
        for (const [key, value] of Object.entries(appSettings.behavior.keyboardShortcuts)) {
          if (!'shortcuts'.includes(key)) {
            const path = 'behavior.keyboardShortcuts.' + key;
            document.querySelector(`input[name='${path}']`).checked = value;
          }
        }
        // Language Models
        $ocrModelDropdownInSettings.dropdown('set selected', appSettings.language.recognitionModel, true);
        $ocrModelDropdown.dropdown('set selected', appSettings.language.recognitionModel, true);
        // Highlighter
        for (const [key, value] of Object.entries(appSettings.highlighter.textHighlighting)) {
          if (!'highlightsPatterns'.includes(key)) {
            const path = 'highlighter.textHighlighting.' + key;
            document.querySelector(`input[name='${path}']`).checked = value;
          }
        }
        // Invisibles Toggle
        appSettings.interface.showInvisibles ? $invisiblesToggleButton.addClass('active') : $invisiblesToggleButton.removeClass('active');
      },
      progressBar: (options = {}) => {
        if (options.reset) {
          $progressLabel.text('');
          return;
        }
        if (/tagging/.test(options.type)) {
          const currentPosition = boxData.indexOf(selectedBox);
          if ($positionSlider.slider('get max') != boxData.length) {
            handler.update.slider({
              value: currentPosition + 1,
              max: boxData.length,
            });
          } else {
            handler.update.slider({ value: currentPosition + 1 });
          }
          if (boxData.every(box => box.filled)) {
            const
              modifiedLines = boxData.filter(box => box.committed);
            $progressSlider.progress({
              value: modifiedLines.length,
              total: boxData.length,
              text: { active: appTranslations['progressIndicatorUpdatingText'], }
            })
          } else {
            $progressSlider.removeClass('active indicating');
            var
              textLines = boxData.filter(box => box.filled);
            $progressSlider.progress({
              value: textLines.length,
              total: boxData.length,
              text: { active: appTranslations['progressIndicatorTaggingText'], }
            });
          }
          return;
        } else {
          $progressSlider.addClass('indicating');
          if (/ocr/.test(options.type)) {
            $progressSlider.progress({
              value: options.progress,
              total: 1,
              text: { active: appTranslations['progressIndicatorAnalyzingText'], }
            });
          } else if (/initializingWorker/.test(options.type)) {
            $progressSlider.progress({
              value: 0,
              total: 1,
              text: { active: options.status + '…', }
            });
          } else if (/regeneratingTextData/.test(options.type)) {
            $progressSlider.progress({
              value: options.value,
              total: options.total,
              text: { active: appTranslations['progressIndicatorRegeneratingText'], }
            });
          }
          return;
        }
      },
      slider: (options) => {
        if (options.max) handler.init.slider();
        if (options.value) $positionSlider.slider('set value', options.value, fireChange = false);
        if (options.min) $positionSlider.slider('setting', 'min', options.min);
      },
      highlighterTable: (enabling) => {
        if (enabling) {
          $highlighterTableRows
            .each((index, elem) => {
              $(elem.querySelector('td:nth-child(1) .checkbox')).checkbox('set enabled');
              $(elem.querySelector('td:nth-child(2)'))[0].classList.remove('disabled');
              $(elem.querySelector('td:nth-child(3) .dropdown'))[0].classList.remove('disabled');
              $(elem.querySelector('td:nth-child(4)'))[0].classList.remove('disabled');
              handler.unhighlightCell(elem.querySelector('td:nth-child(4)'));
            });
        } else {
          $highlighterTableRows
            .each((index, elem) => {
              $(elem.querySelector('td:nth-child(1) .checkbox')).checkbox('set disabled');
              $(elem.querySelector('td:nth-child(2)'))[0].classList.add('disabled');
              $(elem.querySelector('td:nth-child(3) .dropdown'))[0].classList.add('disabled');
              $(elem.querySelector('td:nth-child(4)'))[0].classList.add('disabled');
            });
        }
      },
      boxData: (polyid, newData) => {
        const oldBoxIndex = boxData.findIndex(x => x.polyid == polyid),
          // if oldBoxIndex is -1 then that box doesn't exist and data is new
          oldData = oldBoxIndex > -1 ? boxData[oldBoxIndex] : boxData[0];
        newData.polyid = polyid;
        // check if data is different
        newData.committed = oldData.committed || !oldData.equals(newData);
        boxData[oldBoxIndex] = newData;
        boxDataInfo.setDirty(true);
        lineDataInfo.setDirty(false);
        handler.update.progressBar({ type: 'tagging' });
        return newData.committed;
      },
      boxCoordinates: () => {
        const polyid = parseInt($groundTruthInputField.attr('boxid')),
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
      rectangle: (polyid, data) => {
        const box = boxLayer.getLayer(polyid);
        box.setBounds([[data.y1, data.x1], [data.y2, data.x2]]);
      },
      form: (box) => {
        const
          same = box.polyid == selectedBox?.polyid,
          newText = same && $groundTruthInputField.val().length ? $groundTruthInputField.val() : box.text;
        $groundTruthInputField.val(newText);
        handler.set.virtualKeyboardInput(newText)
        selectedBox = box;
        $groundTruthInputField.attr('boxid', box.polyid);
        $x1Field.val(box.x1);
        $y1Field.val(box.y1);
        $x2Field.val(box.x2);
        $y2Field.val(box.y2);
        handler.update.confidenceScoreField(box);
        handler.focusGroundTruthField();
        handler.update.colorizedBackground();
        handler.update.progressBar({ type: 'tagging' });
        lineDataInfo.setDirty(same);
        handler.close.popups();
      },
      confidenceScoreField: async (box) => {
        $modelConfidenceScoreDetail.text('');
        if ($modelConfidenceScoreEnabledCheckbox[0].checked && box.isModelGeneratedText) {
          $modelConfidenceScoreDetail.text(`${appTranslations['formGroundTruthConfidenceLabel']}: ${Math.round(box.modelConfidenceScore)}%`);
          // colorize if low confidence
          const colorMap = {
            70: 'red',
            85: 'orange',
            95: 'grey',
            100: 'green',
          }
          for (const lowConfidence of Object.keys(colorMap).reverse()) {
            if (box.modelConfidenceScore < lowConfidence) {
              $modelConfidenceScoreDetail.removeClass(Object.values(colorMap).join(' '));
              $modelConfidenceScoreDetail.addClass(colorMap[lowConfidence]);
            }
          }
        }
      },
      downloadButtonsLabels: (options = {}) => {
        const icon = document.createElement('i');
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
      colorizedBackground: async () => {
        $colorizedOutputForms.each(async (_, element) => {
          const
            inputField = $(element).find('.colorized-input-field'),
            outputField = $(element).find('.colorized-output-field')[0],
            colorizedText = await handler.colorizeText(inputField.val());
          outputField.innerHTML = colorizedText;
        });
      },
      localStorage: () => localStorage.setItem(appSettings.localStorageKey, JSON.stringify(appSettings)),
      appSettings: ({ path, value, localStorage }) => {
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
          const
            pathElements = path.split('.'),
            button = document.createElement('div'),
            status = document.createElement('div'),
            inlineLoader = document.createElement('div'),
            lastElementIndex = pathElements.length - 1,
            updatedSettings = pathElements.reduce((obj, key, index) => obj[key] = lastElementIndex === index ? value : { ...obj[key] }, appSettings);
          handler.update.localStorage();
          button.className = 'ui button ok';
          button.tabIndex = '0';
          button.innerText = 'OK';
          status.className = 'ui disabled tertiary button';
          status.innerText = appTranslations['settingsMenuSavedSuccessfullyText'];
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
      patternLabels: () => {
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
    migrateSettings: (oldSettings, downgrade = false) => {
      if (downgrade) {
        // Downgrading settings

        // ignore newer settings
      } else {
        if (oldSettings.appVersion == 0) {
          return appSettings;
        }

        appSettings = oldSettings;

        // Upgrading settings
        if (handler.compareVersions(oldSettings.appVersion, '1.8.0') < 0) {
          // console.info('[Migration]', 'Migrating from', oldSettings.appVersion, 'to', '1.7.3');

          // add new setting
          appSettings.interface.appLanguage = 'system-lang';

          // update keyboard shortcuts
          oldSettings.behavior.keyboardShortcuts.shortcuts.forEach(key => {
            switch (key.name) {
              case "Move to next box":
                key.localizationKey = "keyboardShortcutsTableMoveToNextBox";
                delete key.name;
                break;
              case "Move to previous box":
                key.localizationKey = "keyboardShortcutsTableMoveToPreviousBox";
                delete key.name;
                break;
              // add more cases here as needed
              default:
                // handle default case here
                break;
            }
          });
          appSettings.behavior.keyboardShortcuts.shortcuts = oldSettings.behavior.keyboardShortcuts.shortcuts;
        }
        return appSettings;
      }
    },
    receiveDroppedFiles: async (event) => {
      if (event.length > 2) {
        handler.notifyUser({
          title: appTranslations['notificationTypeTooManyFilesWarningTitle'],
          message: appTranslations['notificationTypeTooManyFilesWarningBody'],
          type: 'error',
        });
        return;
      }
      if (event.length < 1) {
        notifyUser({
          title: appTranslations['notificationTypeTooNoFilesTitle'],
          message: appTranslations['notificationTypeTooNoFilesBody'],
          type: 'error',
        });
        return;
      }
      var
        files = event;
      files.forEach(file => {
        if (file.type.includes('image')) {
          imageFile = file;
        } else if (file.name.endsWith('.box')) {
          boxFile = file;
        } else {
          handler.notifyUser({
            title: appTranslations['notificationTypeInvalidFileTypeTitle'],
            message: appTranslations['notificationTypeInvalidFileTypeBody'],
            type: 'error',
          });
          return;
        }
      });

      if (!imageFile && !imageFileInfo.isProcessed()) {
        handler.notifyUser({
          title: appTranslations['notificationTypeNoImageFileTitle'],
          message: appTranslations['notificationTypeNoImageFileBody'],
          type: 'error',
        });
        return;
      }
      if (imageFile) {
        await handler.load.imageFile(imageFile, sample = false, skipProcessing = boxFile ? true : false);
      }
      if (boxFile) {
        await handler.load.boxFile(boxFile, sample = false, skipWarning = imageFileInfo.isProcessed());
      }
    },
    destroy: {
      positionSlider: () => {
        $positionSlider.slider('destroy');
        $positionSlider.contents().remove()
      },
      progressBar: () => {
        $progressSlider.progress('destroy');
        $progressSlider.children().contents().remove()
      },
    },
    init: {
      slider: () => {
        $positionSlider.slider('destroy');
        $positionSlider.slider({
          min: 1,
          max: boxData.length,
          step: 1,
          start: 1,
          smooth: true,
          labelDistance: 50,
          onMove: (value) => {
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
      workerLogMessage: (message) => {
        message.type = 'recognizing text'.includes(message.status) ? 'ocr' : 'initializingWorker';
        // suppress log messages
        if (!suppressLogMessages[message.status]) {
          handler.update.progressBar(message);
        }
        return message;
      },
      boxFile: (event) => {
        const content = event.target.result;
        if (content && content.length) {
          boxLayer.clearLayers();
          boxData = [];
          switch (handler.getBoxFileType(content)) {
            case BoxFileType.WORDSTR:
              handler.process.wordstr(content);
              break;
            case BoxFileType.CHAR_OR_LINE:
              handler.process.char_or_line(content);
              return;

            default:
              console.error('invalid file format');
              return;
          }
          map.addLayer(boxLayer);
        }
        handler.sortAllBoxes();
        handler.focusBoxID(handler.getBoxContent().polyid);
        handler.update.colorizedBackground();
      },
      wordstr: (content) => {
        const lines = content.split(/\r?\n/);
        // get odd numbered lines
        // lines.filter(index, lines => index % 2 == 1)
        lines
          .forEach((line) => {
            if (line.startsWith('WordStr ')) {
              const
                [coordinates, text] = line.split('#'),
                dimensions = coordinates.split(' '),
                box = new Box({
                  text: text,
                  x1: parseInt(dimensions[1]),
                  y1: parseInt(dimensions[2]),
                  x2: parseInt(dimensions[3]),
                  y2: parseInt(dimensions[4]),
                  isModelGeneratedText: false,
                }),
                rectangle = L.rectangle([[box.y1, box.x1], [box.y2, box.x2]]);
              rectangle.on('edit', handler.editRectangle);
              rectangle.on('click', handler.selectRectangle);
              handler.style.remove(rectangle);
              boxLayer.addLayer(rectangle);
              box.polyid = boxLayer.getLayerId(rectangle);
              boxData.push(box);
            }
          });
      },
      char_or_line: (content) => {
        // TODO: handle char_or_line format
      },
    },
    getBoxFileType: (content) => {
      if (!content.length) boxFileType = BoxFileType.WORDSTR;
      for (key of Object.keys(BoxFileType)) {
        if (key.endsWith('_PATTERN') && BoxFileType[key].test(content)) {
          key = key.replace('_PATTERN', '');
          boxFileType = BoxFileType[key];
          return boxFileType;
        }
      }
      return !content.length ? BoxFileType.WORDSTR : '';
    },
    formatDate: (date) => {
      const options = { month: 'long', day: 'numeric', year: 'numeric' };
      const dateString = date.toLocaleDateString('en-US', options);
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
    get: {
      availableTranslations: async () => {
        // return all filenames in lang directory
        const langFiles = [];
        await $.ajax({
          url: '../../js/lang',
          context: document.body,
          success: function (data) {
            $(data).find('a:contains(".json")').each(function () {
              langFiles.push(this.href.replace(window.location.host, '').replace('https:///', '').replace('http:', ''));
            });
          }
        });
        return langFiles.map(x => x.replace('.json', '').replace(/\/.*\//, ''));
      },
    },
    check: {
      translationExists: async (lang) => {
        try {
          const response = await fetch(`../../js/lang/${lang}.json`, { method: "GET" });

          if (response.ok) {
            // File found, do something with the response
            const translationData = await response.json();
            console.log('Translation data:', translationData);
            return true;
          } else {
            // File not found, load default file
            const defaultResponse = await fetch(`../../js/lang/en-US.json`);
            if (defaultResponse.ok) {
              const defaultTranslationData = await defaultResponse.json();
              console.log('Default translation data:', defaultTranslationData);
            } else {
              console.error('Default translation file not found');
            }
            return false;
          }
        } catch (error) {
          // Handle the error without logging to the console
          console.error('An unexpected error occurred:', error);
          return false;
        }
      }
    },
    load: {
      translations: async (language) => {
        var translationData = null;
        var languageToUse = language;
        // for (const lang of languages) {
        const languages = /system-lang/.test(language) ? navigator.languages: [language]
        for (const lang of languages) {
          try {
            const response = await fetch(`../../js/lang/${lang}.json`);

            if (response.status === 200) {
              translationData = await response.json();
              // console.log(`Translation data loaded for ${lang}:`, translationData);
              break;
              // return translationData; // Use the loaded translation
            }
          } catch (error) {
            console.error(`Error loading translation for ${lang}:`, error);
          }
        }

        // Fallback to 'en-US' if no preferred language files are found
        if (translationData == null) {

          try {
            languageToUse = 'en-US';
            const response = await fetch(`../../js/lang/${languageToUse}.json`);

            if (response.status === 200) {
              translationData = await response.json();
              console.log('Fallback to en-US - Translation data:', translationData);
              // return translationData; // Use the fallback translation
            } else {
              console.error('Fallback translation file not found');
            }
          } catch (error) {
            console.error('An unexpected error occurred while loading the fallback translation:', error);
          }
        }

        appTranslations = translationData;
        // console.info('loaded', appTranslations['locale'], appSettings.interface.appLanguage);
        ///////
        // const response = await fetch(`../../js/lang/${languageToUse}.json`);
        // const data = await response.json();
        // appTranslations = data;
        // appSettings.interface.appLanguage = languageToUse;
        // console.info('loaded', appTranslations['locale'], appSettings.interface.appLanguage);
        const dropdownSelection = /system-lang/.test(language) ? language : languageToUse;
        appSettings.interface.appLanguage = dropdownSelection;
        $appLanguageDropdownInSettings.dropdown('set selected', dropdownSelection, true);
      },
      virtualKeyboard: () => {
        if (virtualKeyboard !== undefined) virtualKeyboard.destroy();
        virtualKeyboard = new Keyboard({
          theme: "simple-keyboard hg-theme-default hg-layout-default",
          layout: virtualKeyboardLayouts['rts'],
          // physicalKeyboardHighlight: true,
          // syncInstanceInputs: true,
          // mergeDisplay: true,
          // debug: true,
          onChange: input => {
            const
              selectionStart = $groundTruthInputField[0].selectionStart,
              selectionEnd = $groundTruthInputField[0].selectionEnd,
              selectionLength = selectionEnd - selectionStart,
              inputLength = input.length - $groundTruthInputField[0].value.length,
              // newCursorPos = inputLength >= 0 ? selectionStart + 1 : selectionStart+1;
              newCursorPos = virtualKeyboardBackspacePressed ? selectionStart - (selectionLength == 0 ? 1 : 0) : selectionStart + 1;
            virtualKeyboardBackspacePressed = false;
            $groundTruthInputField[0].value = input;
            handler.update.colorizedBackground();
            $groundTruthInputField[0].focus();
            $groundTruthInputField[0].setSelectionRange(newCursorPos, newCursorPos);
            // console.log("Input changed", input);
          },
          onInit: (keyboard) => $virtualKeyboard.find('.button').addClass('disabled'),
          onRender: (keyboard) => {
            keyboard.recurseButtons(buttonElement => {
              buttonElement.classList.add('ui', 'button');
              if (buttonElement.getAttribute('data-skbtn') === '') {
                buttonElement.classList.add('disabled');
              }
            });
          },
          onKeyReleased: (button) => handler.focusGroundTruthField(),
          onKeyPress: button => handler.virtualKeyboardKeyPressed(button),
          display: {
            "{escape}": "esc ⎋",
            "{tab}": "tab ⇥",
            "{backspace}": appTranslations['virtualKeyboardBackspaceKeyLabel'],
            "{enter}": appTranslations['virtualKeyboardEnterKeyLabel'],
            "{capslock}": appTranslations['virtualKeyboardCapsLockKeyLabel'],
            "{shiftleft}": "shift ⇧",
            "{shiftright}": "shift ⇧",
            "{controlleft}": "ctrl ⌃",
            "{controlright}": "ctrl ⌃",
            "{altleft}": appTranslations['virtualKeyboardAltKeyLabel'],
            "{altright}": appTranslations['virtualKeyboardAltKeyLabel'],
            "{metaleft}": "cmd ⌘",
            "{metaright}": "cmd ⌘",
            '{space}': appTranslations['virtualKeyboardSpaceKeyLabel'],
            '{grave}': appTranslations['virtualKeyboardGraveKeyLabel'],
            '{acute}': appTranslations['virtualKeyboardAcuteKeyLabel'],
            '{kavyka}': appTranslations['virtualKeyboardKavykaKeyLabel'],
            '{cyrillic}': appTranslations['virtualKeyboardCyrillicKeyLabel'],
            '{latin}': appTranslations['virtualKeyboardLatinKeyLabel'],
          }
        });
      },
      tesseractWorker: async () => {
        const
          langPathURL = appSettings.language.languageModelIsCustom ? '../../assets' : 'https://tessdata.projectnaptha.com/4.0.0_best',
          isGzip = appSettings.language.languageModelIsCustom ? false : true;
        worker = await Tesseract.createWorker({
          logger: m => handler.process.workerLogMessage(m),
          langPath: langPathURL,
          gzip: isGzip,
        });
        // try {
        await handler.load.tesseractLanguage();
        // } catch (error) {
        //   console.error(error);
        //   notifyUser({
        //     title: notificationTypes.error.networkError.title,
        //     message: 'Failed to load language model. You may not be connected to the internet.',
        //     type: notificationTypes.error.networkError.type,
        //   });
        //   return false;
        // }
        await worker.setParameters({
          tessedit_ocr_engine_mode: 1,
          tessedit_pageseg_mode: 1,// 12
        });
        return true;
      },
      tesseractLanguage: async () => {
        try {
          await worker.loadLanguage(appSettings.language.recognitionModel);
          await worker.initialize(appSettings.language.recognitionModel);
          return true;
        } catch (error) {
          if (error.toString().includes('Error: Network error while fetching')) {
            console.log(error);
            handler.notifyUser({
              title: notificationTypes.error.loadingLanguageModelError.title,
              message: appTranslations['notificationTypeLoadingLanguageModelErrorBody']
                .replace('${appSettings.language.recognitionModel}', `${appSettings.language.recognitionModel}`),
              type: notificationTypes.error.loadingLanguageModelError.type,
              class: notificationTypes.error.loadingLanguageModelError.class,
            });
            appSettings.language.recognitionModel = 'RTS_from_Cyrillic';
            $ocrModelDropdownInSettings.dropdown('set selected', appSettings.language.recognitionModel, false);
            return await handler.load.tesseractLanguage();
          } else if (error.toString().includes('NetworkError: Load failed') || error.toString().includes('Failed to load resource: The Internet connection')) {
            console.log(error);
            handler.notifyUser({
              title: notificationTypes.error.networkError.title,
              message: 'notificationTypeNetworkErrorBody',
              type: notificationTypes.error.networkError.type,
              class: notificationTypes.error.networkError.class,
            });
          } else {
            console.log(error);
            throw error;
          }
        }
      },
      dropdowns: () => {
        $appLanguageDropdownInSettings.dropdown({
          onChange: async (value, text, $selectedItem) => {
            handler.set.loadingState({ buttons: true });
            // const newLanguage = /system-lang/.test(value) ? navigator.languages : value;
            await handler.update.interfaceLanguage(value);
            handler.update.localStorage();
            handler.set.loadingState({ buttons: false });
            $appLanguageDropdownInSettings.dropdown('set selected', value, true);
          }
        });
        $ocrModelDropdown.dropdown({
          onChange: async (value, text, $selectedItem) => {
            $ocrModelDropdown.addClass('loading');
            handler.set.loadingState({ buttons: true });
            appSettings.language.recognitionModel = value;
            const custom = value == 'RTS_from_Cyrillic' ? true : false;
            if (appSettings.language.languageModelIsCustom != custom) {
              appSettings.language.languageModelIsCustom = custom;
              await handler.load.tesseractWorker();
            } else {
              await handler.load.tesseractLanguage();
            }
            $ocrModelDropdownInSettings.dropdown('set selected', appSettings.language.recognitionModel, true);
            $ocrModelDropdown.removeClass('loading');
            handler.set.loadingState({ buttons: false });
            handler.update.localStorage();
          }
        });
        $ocrModelDropdownInSettings.dropdown({
          onChange: async (value, text, $selectedItem) => {
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
              response = await handler.load.tesseractWorker();
            } else {
              await handler.load.tesseractLanguage();
            }
            $ocrModelDropdown.dropdown('set selected', appSettings.language.recognitionModel, true);
            $ocrModelDropdownInSettings.removeClass('loading');
            handler.set.loadingState({ buttons: false });
            handler.update.localStorage();
          }
        });
        $ocrModelDropdownInSettings.dropdown('set selected', appSettings.language.recognitionModel, true);
      },
      keyboardShortcuts: () => {
        $window.off('keyup');
        $window.keyup(event => {
          if (handler.keyboardShortcuts.isModifierKey(event.key)) {
            pressedModifiers[event.key] = false;
            // console.log('removed', event.key, 'from pressedModifiers', pressedModifiers);
          }
          if (event.target == $groundTruthInputField[0]) {
            if (handler.keyboardShortcuts.isNavigationKey(event.key)) {
              // allow event to continue selection, then call showCharInfoPopup
              setTimeout(handler.showCharInfoPopup(event), 0);
              return;
            }
          }
        });
        $window.off('keydown');
        $window.keydown(event => {
          // Check if the pressed key is a modifier key
          if (handler.keyboardShortcuts.isModifierKey(event.key)) {
            pressedModifiers[event.key] = true;
            return;
          }
          if (event.target == $groundTruthInputField[0]) {
            if (!handler.keyboardShortcuts.isNavigationKey(event.key) && event.key == 'a') {
              // allow event to continue selection, then call showCharInfoPopup
              setTimeout(handler.showCharInfoPopup(event), 0);
              return;
            }
          }

          // Combine modifiers with the pressed key to form the complete shortcut
          const
            modifierKeys = Object.keys(pressedModifiers).filter(
              key => pressedModifiers[key]).join("+"),
            key = (modifierKeys ? modifierKeys + "+" : "") + event.key.toUpperCase(),
            matchingAction = appSettings.behavior.keyboardShortcuts.shortcuts.find(action => action.keyCombo.replace(/\s/g, '') === key);

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
      eventListeners: () => {
        $settingsModal[0].addEventListener('change', event => {
          const
            path = event.target.name,
            value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
          handler.update.appSettings({ path: path, value: value });
        });
      },
      sliders: async () => {
        const sizes = [
          "settingsMenuImageViewSliderLabelTiny",
          "settingsMenuImageViewSliderLabelShort",
          "settingsMenuImageViewSliderLabelNormal",
          "settingsMenuImageViewSliderLabelTall",
          "settingsMenuImageViewSliderLabelHuge"];
        // await handler.load.translations(appSettings.interface.appLanguage);
        const labels = sizes.map(size => appTranslations[size]);
        $imageViewHeightSlider.slider({
          min: 100,
          max: 900,
          step: 200,
          autoAdjustLabels: false,
          interpretLabel: value => labels[value],
          onChange: value => {
            if (value < 300) {
              // find item with text 'Tiny'
              $imageViewHeightSlider.find('.label').each(function () {
                if (this.innerText == appTranslations['settingsMenuImageViewSliderLabelTiny']) {
                  // append span element with additional text
                  this.innerHTML += '<span class="ui italic grey text">&nbsp;– ' + appTranslations['settingsMenuImageViewSliderClippingWarning'] + '</span>';
                }
              });
            } else {
              // remove span element from label
              $imageViewHeightSlider.find('.label').each(function () {
                if (this.innerText.includes(appTranslations['settingsMenuImageViewSliderLabelTiny'])) {
                  this.innerHTML = appTranslations['settingsMenuImageViewSliderLabelTiny'];
                }
              });
            }

            handler.set.mapSize({ height: value });
            handler.update.appSettings({ path: 'interface.imageView', value: value });
          },
        });
        $imageViewHeightSlider.slider('set value', appSettings.interface.imageView, fireChange = false);
      },
      settings: () => {
        handler.getAppInfo();
        $appInfoVersion.text(appInfo.version);
        appSettings.appVersion = appInfo.version;
        // format date to month date, year
        const date = new Date(appInfo.updated);
        $appInfoUpdated.text(handler.formatDate(date));
        $settingsMenuItems.tab({ onLoad: () => balanceText.updateWatched(), });
        $settingsModal.modal({
          // inverted: true,
          blurring: true,
          onHidden: () => {
            // hide status if still visible
            if ($settingsModalStatusMessage[0]) $settingsModalStatusMessage[0].innerHTML = '';
            if (invalidPatterns || identicalPatternNames) {
              const
                title = invalidPatterns ? notificationTypes.error.invalidPatternsError.title : notificationTypes.error.identicalPatternNamesError.title,
                message = invalidPatterns ? 'notificationTypeInvalidPatternsErrorBody' : 'notificationTypeIdenticalPatternNamesErrorBody',
                type = invalidPatterns ? notificationTypes.error.invalidPatternsError.type : notificationTypes.error.identicalPatternNamesError.type,
                classType = invalidPatterns ? notificationTypes.error.invalidPatternsError.class : notificationTypes.error.identicalPatternNamesError.class;
              handler.notifyUser({
                title: title,
                message: message,
                type: type,
                class: classType,
                actions: [{
                  text: appTranslations['askUserFixNowText'],
                  click: handler.open.settingsModal.bind(handler.open, 'highlighter-settings'),
                }]
              });
            }
          }
        });
        const localStorageValue = localStorage.getItem(appSettings.localStorageKey);
        if (localStorageValue) {
          try {
            localStorageSettings = JSON.parse(localStorageValue);
          } catch (error) {
            console.warn('Cannot parse localStorage', error);
            localStorageSettings = { 'appVersion': undefined };
          } finally {
            handler.update.appSettings({ localStorage: localStorageSettings });
          }
        } else {
          handler.update.appSettings({ localStorage: { appVersion: undefined } });
          handler.update.settingsModal();
        }
      },
      popups: () => {
        $imageFileInputButton
          .popup({
            popup: $useSamplePopup,
            position: 'top left',
            hoverable: true,
            delay: {
              hide: 800,
            }
          });
        $tooltipTriggers.popup();
      },
      unicodeData: async () => {
        await $.ajax({
          url: '../../assets/unicodeData.csv',
          dataType: 'text',
          success: data => {
            const
              parsedData = $.csv.toObjects(data, {
                separator: ';',
                delimiter: '"',
              });
            unicodeData = parsedData;
          }
        });
      },
      dropzone: () => {
        $html.dropzone({
          url: handler.receiveDroppedFiles,
          uploadMultiple: true,
          parallelUploads: 3,
          disablePreviews: true,
          clickable: false,
          acceptedFiles: "image/*,.box",
        });
        $html.on('drag dragenter dragover', (event) => {
          event.preventDefault();
          event.stopPropagation();

          if ($html.hasClass('dz-drag-hover')) {
            $dropzone
              .dimmer('show')
              .addClass('raised');
          }
          window.setTimeout(() => {
            !$html.hasClass('dz-drag-hover') ? $dropzone
              .dimmer('hide')
              .removeClass('raised') : null;
          }, 1500);
        });
        $html.on('drop', event => {
          event.preventDefault();
          event.stopPropagation();

          !$html.hasClass('dz-drag-hover') ? $dropzone.transition('pulse') : null;
        });
      },
      sampleImageAndBox: async (event) => {
        handler.close.settingsModal();
        // handle NetworkError: Load failed when parsing ../../assets/sampleImage.box
        if (await handler.load.imageFile(event, true))
          await handler.load.boxFile(event, true, true);
      },
      boxFile: async function (event, sample = false, skipWarning = false) {
        if (!skipWarning && appSettings.behavior.alerting.enableWarrningMessagesForOverwritingDirtyData && boxDataInfo.isDirty()) {
          const response = await handler.askUser({
            title: notificationTypes.warning.overridingUnsavedChangesWarning.title,
            message: 'notificationTypeOverridingUnsavedChangesWarningBody',
            type: notificationTypes.warning.overridingUnsavedChangesWarning.type,
            actions: [{
              text: appTranslations['askUserCancelText'],
              class: 'cancel',
            }, {
              text: appTranslations['askUserConfirmText'],
              class: 'positive',
            }],
          });
          if (!response) {
            return false;
          }
        }
        handler.set.loadingState({ buttons: true });
        const
          reader = new FileReader(),
          defaultBoxUrl = '../../assets/sampleImage.box';
        var file = null;
        if (sample) {
          file = new File([await (await fetch(defaultBoxUrl)).blob()], 'sampleImage.box');
        } else if (event.target?.files[0].name.includes('box')) {
          // } else if (event.name.includes('box')) {
          // file = event;
          // TODO: Fix file upload handling for all cases (image+box, image, box, files uncomitted, new files, samples)
          file = event.target.files[0];
        } else {
          // file = this.files[0];
          file = event;
        }

        const fileExtension = file.name.split('.').pop();
        if (!'box'.includes(fileExtension)) {
          handler.notifyUser({
            title: notificationTypes.error.invalidFileTypeError.title,
            message: appTranslations['notificationTypeInvalidFileTypeErrorBody']
              .replace('${fileExtension}', `${fileExtension}`),
            type: notificationTypes.error.invalidFileTypeError.type,
            class: notificationTypes.error.invalidFileTypeError.class,
          });
          return false;
        } else if (appSettings.behavior.alerting.enableWarrningMessagesForDifferentFileNames && imageFileName != file.name.split('.').slice(0, -1).join('.') && imageFileName != undefined) {
          const
            response = await handler.askUser({
              title: notificationTypes.warning.nameMismatchError.title,
              message: appTranslations['notificationTypeNameMismatchErrorBody']
                .replace('${file.name}', `${file.name}`)
                .replace('${imageFileName}', `${imageFileName}`),
              type: notificationTypes.warning.nameMismatchError.type,
              actions: [{
                text: appTranslations['askUserDenyText'],
                class: 'cancel',
              }, {
                text: appTranslations['askUserConfirmText'],
                class: 'positive',
              }],
            });
          if (!response) {
            handler.set.loadingState({ main: false, buttons: false });
            return false;
          }
        }
        reader.readAsText(file);
        file.name.split('.).slice(0, -1').join('.');
        boxFileNameForButton = file;
        $(reader).on('load', handler.process.boxFile);
        handler.set.loadingState({ main: false, buttons: false });
      },
      imageFile: async function (e, sample = false, skipProcessing = false) {
        if (appSettings.behavior.alerting.enableWarrningMessagesForOverwritingDirtyData && boxDataInfo.isDirty() || lineDataInfo.isDirty()) {
          const response = await handler.askUser({
            title: notificationTypes.warning.overridingUnsavedChangesWarning.title,
            message: 'notificationTypeOverridingUnsavedChangesWarningBody',
            type: notificationTypes.warning.overridingUnsavedChangesWarning.type,
            actions: [{
              text: appTranslations['askUserCancelText'],
              class: 'cancel',
            }, {
              text: appTranslations['askUserConfirmText'],
              class: 'positive',
            }],
          });
          if (!response) {
            // $imageFileInput.val(imageFileNameForButton.name);
            return false;
          }
        }
        handler.set.loadingState({ buttons: true });

        const
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
          imageFileNameForButton = file.name;
          filename = file.name;
        }

        handler.load.image(sample ? defaultImageUrl : _URL.createObjectURL(file))
          .then(async img => {
            // console.log('Image loaded', img);
            if (!map) { handler.create.map('mapid'); }
            map.eachLayer(layer => map.removeLayer(layer));

            imageHeight = img.height;
            imageWidth = img.width;

            const
              bounds = [[0, 0], [parseInt(imageHeight), parseInt(imageWidth)]],
              bounds2 = [[imageHeight - 300, 0], [imageHeight, imageWidth]];
            if (image) {
              await $(image._image).fadeOut(750, async () => {
                map.removeLayer(image);
                image = new L.imageOverlay(img.src, bounds, imageOverlayOptions).addTo(map);
                await $(image._image).fadeIn(500);
              });
            } else {
              map.fitBounds(bounds2);
              image = new L.imageOverlay(img.src, bounds, imageOverlayOptions).addTo(map);
              await $(image._image).fadeIn(750);
            }

            handler.update.downloadButtonsLabels({
              boxDownloadButton: imageFileName + '.box',
              groundTruthDownloadButton: imageFileName + '.gt.txt'
            });
          })
          .catch(error => {
            console.error('Image load failed:', error);
            const fileExtension = file.name.split('.').pop();
            handler.notifyUser({
              title: notificationTypes.error.invalidFileTypeError.title,
              message: appTranslations['notificationTypeInvalidFileTypeErrorBody']
                .replace('${fileExtension}', `${fileExtension}`),
              type: notificationTypes.error.invalidFileTypeError.type,
              class: notificationTypes.error.invalidFileTypeError.class,
            });
          })
        // remove current box data
        boxLayer.clearLayers();
        boxData = [];
        boxDataInfo.setDirty(false);
        lineDataInfo.setDirty(false);
        $groundTruthInputField.val('');
        handler.destroy.positionSlider();
        handler.destroy.progressBar();
        handler.update.colorizedBackground();

        // Load Tesseract Worker
        await handler.load.tesseractWorker();

        if (appSettings.behavior.onImageLoad.detectAllLines && !sample && !skipProcessing) {
          await handler.generate.initialBoxes(includeSuggestions = appSettings.behavior.onImageLoad.includeTextForDetectedLines);
        }
        handler.set.loadingState({ main: false, buttons: false });
        if (appSettings.behavior.onImageLoad.detectAllLines) {
          handler.focusGroundTruthField();
        }
        await $(image._image).animate({ opacity: 1 }, 500);
        imageFileInfo.setProcessed();

        return true;

      },
      image: (source) => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = error => reject(error);
          img.src = source;
        });
      },
    },
    focusGroundTruthField: () => {
      $groundTruthInputField.focus();
      // $groundTruthInputField.select();
    },
    focusBoxID: (id, options = { isUpdated: false, zoom: true }) => {
      if (!options.isUpdated) options.isUpdated = false;
      if (!options.zoom) options.zoom = true;
      handler.style.remove(selectedPoly, options.isUpdated);
      handler.map.disableEditBox(selectedBox);
      const box = boxLayer.getLayer(id);
      handler.update.form(boxData.find(x => x.polyid == id));
      if (options.zoom) handler.map.focusShape(box, options.isUpdated);
      handler.style.setActive(box);
    },
    submitText: (event) => {
      event?.preventDefault();
      if (this.disabled) return false;
      const
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
      return modified;
    },
    style: {
      setProcessing: (poly) => poly?.setStyle(boxState.boxProcessing),
      setActive: (poly) => poly?.setStyle(boxState.boxActive),
      setCommitted: (poly) => poly?.setStyle(boxState.boxComitted),
      remove: (poly, isUpdated = false) => { poly?.setStyle(isUpdated ? boxState.boxComitted : boxState.boxInactive); },
    },
    map: {
      disableEditBox: (shape) => { selectedPoly && shape != selectedPoly ? selectedPoly.editing.disable() : ''; },
      enableEditBox: (shape) => {
        selectedPoly = shape;
        shape.editing.enable();
      },
      getMapPosition: () => map.getBounds(),
      invalidateSize: () => map ? setTimeout(() => map.invalidateSize(), 500) : '',
      fitImage: () =>
        map.flyToBounds(image.getBounds(), {
          // paddingBottomRight: mapPaddingBottomRight,
          duration: .25,
          easeLinearity: .25,
          animate: true,
        }),
      fitBounds: (bounds) =>
        map.flyToBounds(bounds, {
          maxZoom: maxZoom,
          animate: true,
          paddingBottomRight: mapPaddingBottomRight,
          duration: .25,
          easeLinearity: .25,
        }),
      focusShape: (box, isUpdated = false) => {
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
    getBoxContent: (previous = false) => {
      // if ('undefined'.includes(typeof selectedBox)) return boxData[0];
      const
        range = boxData.length,
        el = boxData.findIndex(el => el.polyid == selectedBox?.polyid);
      if (el == -1) return boxData[0];
      return previous ? boxData[(el + range - 1) % range] : boxData[(el + 1) % range];
    },
    getNextBoxContentAndFill: () => {
      const
        isUpdated = handler.submitText(),
        box = handler.getBoxContent();
      handler.focusBoxID(box.polyid, { isUpdated });
    },
    getPreviousBoxContentAndFill: () => {
      const
        isUpdated = handler.submitText(),
        box = handler.getBoxContent(previous = true);
      handler.focusBoxID(box.polyid, { isUpdated });

    },
    download: {
      file: async (type, event) => {
        event?.preventDefault() && event?.stopPropagation();
        if (!boxData.length) {
          handler.notifyUser({
            title: notificationTypes.warning.nothingToDownloadWarning.title,
            message: 'notificationTypeNothingToDownloadWarningBody',
            type: notificationTypes.warning.nothingToDownloadWarning.type,
            class: notificationTypes.warning.nothingToDownloadWarning.class,
          });
          return false;
        }
        if (lineDataInfo.isDirty()) {
          handler.notifyUser({
            title: notificationTypes.error.commitLineError.title,
            message: 'notificationTypeCommitLineErrorBody',
            type: notificationTypes.error.commitLineError.type,
            class: notificationTypes.error.commitLineError.class,
          });
          return false;
        }
        handler.sortAllBoxes();
        boxData.forEach(box => box.text = box.text.replace(/(\r\n|\n|\r)/gm, ''));
        var
          content = '',
          fileExtension = '';
        switch (type) {
          case 'box':
            content = await handler.generate.boxFileContent();
            fileExtension = 'box';
            break;
          case 'ground-truth':
            content = await handler.generate.groundTruthContent();
            fileExtension = 'gt.txt';
            break;

          default:
            break;
        }
        const downloadAnchor = document.createElement('a');
        downloadAnchor.href = 'data:application/text;charset=utf-8,' + encodeURIComponent(content);
        downloadAnchor.download = imageFileName + '.' + fileExtension;
        downloadAnchor.target = '_blank';
        downloadAnchor.style.display = 'none';

        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        document.body.removeChild(downloadAnchor);
        handler.notifyUser({
          title: notificationTypes.info.fileDownloadedInfo.title,
          message: appTranslations['notificationTypeFileDownloadedInfoBody']
            .replace('${imageFileName}', `${imageFileName}`)
            .replace('${fileExtension}', `${fileExtension}`),
          type: notificationTypes.info.fileDownloadedInfo.type,
          class: notificationTypes.info.fileDownloadedInfo.class,
        });
        boxDataInfo.setDirty(false);
      },
    },
    generate: {
      boxFileContent: async (event) => {
        event?.preventDefault();
        var content = '';
        if (BoxFileType.WORDSTR === boxFileType) {
          for (const box of boxData) {
            content = `${content}WordStr ${box.x1} ${box.y1} ${box.x2} ${box.y2} 0 #${box.text}\n`;
            content = `${content}\t ${box.x2 + 1} ${box.y1} ${box.x2 + 5} ${box.y2} 0\n`;
          }
        }
        return content;
      },
      groundTruthContent: async (event) => {
        event?.preventDefault();
        var content = '';
        if (BoxFileType.WORDSTR === boxFileType) {
          for (const box of boxData) {
            content = `${content}${box.text}\n`;
          }
        }
        return content;
      },
      textSuggestion: async () => {
        $regenerateTextSuggestionForSelectedBoxButton.addClass('disabled double loading');
        suppressLogMessages['recognizing text'] = true;

        if (boxLayer.getLayers().length) {
          const
            results = await handler.ocr.detect([selectedBox]),
            element = boxData.findIndex(el => el.polyid == selectedBox?.polyid);
          boxData[element].text = results.length ? results[0].text : selectedBox.text;
          $groundTruthInputField.val(boxData[element].text);
          handler.focusBoxID(boxData[element].polyid, { zoom: false })
        }

        suppressLogMessages['recognizing text'] = false;
        $regenerateTextSuggestionForSelectedBoxButton.removeClass('disabled double loading');
      },
      textSuggestions: async () => {
        $regenerateTextSuggestionsButton.addClass('disabled double loading');
        if (appSettings.behavior.alerting.enableWarrningMessagesForOverwritingDirtyData && boxDataInfo.isDirty()) {
          const response = await handler.askUser({
            title: notificationTypes.warning.replacingTextWarning.title,
            message: 'notificationTypeReplacingTextWarningBody',
            type: notificationTypes.warning.replacingTextWarning.type,
            actions: [{
              text: appTranslations['askUserCancelText'],
              class: 'cancel',
            }, {
              text: appTranslations['askUserConfirmText'],
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
        const mapPosition = handler.map.getMapPosition();
        handler.map.fitImage();

        if (boxLayer.getLayers().length) {
          const results = await handler.ocr.detect(boxData);
          // TODO: this does not seem to be needed here
          // await Promise.all(boxData.map(async (box) => {
          // if (results.length) {
          // const result = results?.find(x => box.equals(x));
          // box.text = result?.text;
          // }
          // }));
          handler.focusBoxID(selectedBox.polyid, { zoom: false })
        }
        suppressLogMessages['recognizing text'] = false;
        handler.map.fitBounds(mapPosition);
        handler.set.loadingState({ buttons: false, main: false });
        $regenerateTextSuggestionsButton.removeClass('disabled double loading');
      },
      initialBoxes: async (includeSuggestions = true) => {
        $redetectAllBoxesButton.addClass('disabled double loading');

        if (appSettings.behavior.alerting.enableWarrningMessagesForOverwritingDirtyData && boxDataInfo.isDirty()) {
          const response = await handler.askUser({
            title: notificationTypes.warning.replacingTextWarning.title,
            message: 'notificationTypeReplacingTextWarningBody',
            type: notificationTypes.warning.replacingTextWarning.type,
            actions: [{
              text: appTranslations['askUserCancelText'],
              class: 'cancel',
            }, {
              text: appTranslations['askUserConfirmText'],
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
          const
            results = await handler.ocr.detect(),
            textLines = results.data.lines;
          if (!textLines.length) {
            handler.set.loadingState({ buttons: false, main: false });
            return false;
          }

          textLines.forEach(line => line.text = line.text.replace(/(\r\n|\n|\r)/gm, ""));
          await handler.ocr.insertSuggestions(includeSuggestions, textLines);
          handler.focusBoxID(handler.getBoxContent().polyid);
          handler.set.loadingState({ buttons: false, main: false });
          handler.init.slider()
          // boxDataInfo.setDirty(false);
          handler.update.progressBar({ type: 'tagging' });
        } catch (error) {
          console.log(error);
          handler.set.loadingState({ buttons: false, main: false });
        }

        $redetectAllBoxesButton.removeClass('disabled double loading');
      },
    },
    ocr: {
      insertSuggestions: async (includeSuggestions, textLines) => {
        boxLayer.clearLayers();
        boxData = [];
        for (const line of textLines) {
          const
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
          lineDataInfo.setDirty(true);
          boxDataInfo.setDirty(true);
        }
        map.addLayer(boxLayer);
      },
      detect: async (boxList = []) => {
        if (!boxList.length) { return await worker.recognize(image._image); }
        for (const box of boxList) {
          const layer = boxLayer.getLayer(box.polyid);
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
          lineDataInfo.setDirty(true);
          boxDataInfo.setDirty(true);
          box.committed = false;
          box.visited = false;
          handler.style.remove(layer);
        };
        return boxList;
      },
    },
    close: {
      settingsModal: () => {
        $settingsModal.modal('hide');
        handler.setKeyboardControl('form');
      },
      popups: () => {
        $popups.popup('hide all');
        handler.setKeyboardControl('form');
      },
    },
    open: {
      settingsModal: (location = '') => {
        handler.setKeyboardControl('settings');
        handler.close.popups();
        $settingsModal.modal('show');
        if (location.length) {
          $settingsMenuItems.removeClass('active');
          $settingsMenuPaneTabs.removeClass('active');
          $settingsMenuItems.filter('[data-tab="' + location + '"]').addClass('active');
          $settingsMenuPaneTabs.filter('[data-tab="' + location + '"]').addClass('active');
          balanceText.updateWatched();
        }
        balanceText.updateWatched();
      },

    },
    toggleInvisibles: () => {
      const
        showInvisibles = !appSettings.interface.showInvisibles,
        path = 'interface.showInvisibles',
        value = showInvisibles;
      handler.update.appSettings({ path, value });
      handler.update.colorizedBackground();
      handler.focusGroundTruthField();
    },
    showCharInfoPopupFromMouseClick: (event) => { if (/mouseup/.test(event.type)) { setTimeout(() => { handler.showCharInfoPopup(event); }, 0); } },
    showCharInfoPopup: (event) => {
      if (!appSettings.interface.editorTools.unicodeInfoPopup) return;
      var selection = '';
      if (window.getSelection) {
        selection = window.getSelection();
      } else if (document.selection) {
        selection = document.selection.createRange();
      }

      // Firefox bug workaround
      if (selection.toString().length == 0) {
        const
          startPosition = $groundTruthInputField[0].selectionStart,
          endPosition = $groundTruthInputField[0].selectionEnd;
        selection = $groundTruthInputField[0].value.substring(startPosition, endPosition);
      }
      // if selection outside of ground truth field then close char info popup
      // if (!selection.anchorNode || !$.contains($groundTruthForm[0], selection.anchorNode)) {
      //   handler.close.popups();
      //   return false;
      // }
      if (selection.anchorNode == null || !event.target.id.includes('formtxt') || selection.toString().length < 1) {
        handler.close.popups();
        return false;
      }

      // if cmd/ctrl + a then select all text field
      if ((event.ctrlKey || event.metaKey) && event.keyCode == 65) { $groundTruthInputField.select(); }

      const results = handler.getUnicodeInfo(selection.toString());
      // TODO: replace max length with a programmatic solution
      if (results.length <= 0 || results.length > 15) {
        handler.close.popups();
        return false;
      } else {
        const content = handler.create.infoPopupContent(results);

        if ($groundTruthForm.popup('is visible')) {
          $groundTruthForm.popup('change content (html)', content);
        } else if ($groundTruthForm.popup('is hidden')) {
          $groundTruthForm.popup({ on: 'manual', 'html': content, closable: false }).popup('show');
        } else {
          console.error('Unknown Char Info popup state');
        }
        // $groundTruthForm.popup('get popup').css('max-height', '20rem');
        // $groundTruthForm.popup('get popup').css('overflow-y', 'auto');
        $groundTruthForm.popup('get popup').css('scrollbar-width', 'none');
        $groundTruthForm.popup('get popup').css('scrollbar-width', 'none');
        $groundTruthForm.popup('get popup').css('-ms-overflow-style', 'none');
        $groundTruthForm.popup('get popup').css('scrollbar-width', 'none');
      }
    },
    bindInputs: () => {
      handler.bindColorizerOnInput();
      $groundTruthInputField.on('input', event => {
        lineDataInfo.setDirty(true);
        handler.set.virtualKeyboardInput(event.target.value);
      });
      // $groundTruthInputField.on('mousedown', event => {
      //   handler.set.virtualKeyboardInput(event.target.value)
      //   console.log("here", event.target.value);
      // });
      $textHighlightingEnabledCheckbox.checkbox({
        onChange: () => {
          handler.update.highlighterTable($textHighlightingEnabledCheckbox[0].checked);
          handler.update.colorizedBackground();
          handler.saveHighlightsToSettings();
        }
      });
      $modelConfidenceScoreEnabledCheckbox.checkbox({ onChange: async () => { await handler.update.confidenceScoreField(selectedBox); } });
      // $groundTruthInputField.bind('mouseup', handler.showCharInfoPopupFromMouseClick)
      $window.bind('mouseup', handler.showCharInfoPopupFromMouseClick)
      $coordinateFields.on('input', handler.update.boxCoordinates);
      $boxFileInput.on('change', handler.load.boxFile);
      $imageFileInput.on('change', handler.load.imageFile);
      $checkboxes.checkbox();
      $checkboxes.filter('.master')
        .checkbox({
          // check all children
          onChecked: function () { $(this).closest('.item').siblings().find('.child').checkbox('set enabled'); },
          // disable all children
          onUnchecked: function () { $(this).closest('.item').siblings().find('.child').checkbox('set disabled'); }
        })
        ;
    },
    bindButtons: () => {
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
    addBehaviors: () => {
      $groundTruthInputField.focus(() => $groundTruthColorizedOutput.addClass('focused'));
      $groundTruthInputField.blur(() => $groundTruthColorizedOutput.removeClass('focused'));
    },
    initialize: async () => {
      handler.bindInputs();
      handler.bindButtons();
      handler.addBehaviors();
      $imageFileInput.prop('disabled', false);
      boxDataInfo.setDirty(false);
      lineDataInfo.setDirty(false);
      handler.load.settings();
      handler.setKeyboardControl('form');
      // handler.set.loadingState({ buttons: false });
      await handler.load.unicodeData();
      handler.load.dropzone();
      handler.load.dropdowns();
      handler.load.popups();
      handler.load.sliders();
      handler.create.highlighterTable();
      // TODO: Keyboard shortcuts table not behaving properly in settings
      handler.create.keyboardShortcutsTable();
      handler.load.eventListeners();

      handler.saveHighlightsToSettings();
      handler.saveKeyboardShortcutsToSettings();

      handler.load.virtualKeyboard();

      handler.delete.expiredNotifications();
      balanceText($balancedText, { watch: true });
      await handler.hideSplashScreen();

    },
    hideSplashScreen: async () => {
      let lang = appSettings.interface.appLanguage;
      // let lang = $appLanguageDropdownInSettings.dropdown('get value');
      await handler.update.interfaceLanguage(lang);
      $body[0].style.transition = "opacity 0.5s ease-in-out";
      $body[0].style.opacity = "1";
    },
  };
  const Keyboard = window.SimpleKeyboard.default;
  availableShortcutActions = [
    {
      // target: $window,
      icon: 'arrow right',
      // name: 'Move to next box',
      localizationKey: 'keyboardShortcutsTableMoveToNextBox',
      action: handler.getNextBoxContentAndFill,
    },
    {
      // target: $window,
      icon: 'arrow left',
      // name: 'Move to previous box',
      localizationKey: 'keyboardShortcutsTableMoveToPreviousBox',
      action: handler.getPreviousBoxContentAndFill,
    },
  ],

    app.handler = handler;

  try {
    // Start the Magic
    await app.handler.initialize();
    // reset errors count
    localStorage.removeItem(appSettings.localStorageKey + '-loading-error');
  } catch (error) {
    // check if already happened several times
    const times = localStorage.getItem(appSettings.localStorageKey + '-loading-error');
    var actions = [];
    switch (true) {
      case parseInt(times) >= 4:
        actions = [{
          text: 'Try again',
          class: 'positive',
        }, {
          text: 'Report issue...',
          class: 'red',
          icon: 'github',
          click: () => {
            window.open('https://github.com/mariuspenteliuc/box-editor-for-tesseract/issues/new?assignees=&labels=help+wanted&projects=&template=website-loading-error.md&title=App+Loading+Error', '_blank');
          }
        }];
        break;
      case parseInt(times) >= 3:
        actions = [{
          text: appTranslations['askUserRetryText'],
          class: 'positive',
        }];
        break;
      default:
        localStorage.setItem(appSettings.localStorageKey + '-loading-error', times ? parseInt(times) + 1 : 1);
        location.reload();
        return;
    }
    handler.hideSplashScreen();
    await handler.askUser({
      title: 'Loading Error!',
      message: 'App encountered repeated errors while loading. Click "Try again" to delete the local storage and try again. This will reset all the settings and data.',
      type: 'loadingError',
      actions: actions,
    }).then(() => {
      localStorage.setItem(appSettings.localStorageKey + '-loading-error', times ? parseInt(times) + 1 : 1);
      handler.clearLocalStorage(loadingError = false);
    });
  }

};

// attach ready event
$(document).ready(app.ready);