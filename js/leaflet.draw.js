/*
 Leaflet.draw 1.0.3, a plugin that adds drawing and editing tools to Leaflet powered maps.
 (c) 2012-2017, Jacob Toye, Jon West, Smartrak, Leaflet

 https://github.com/Leaflet/Leaflet.draw
 http://leafletjs.com
 */
!function (t, e, i) {
    function o(t, e) {
        for (; (t = t.parentElement) && ! t.classList.contains(e);)

        return t
    }
    L.drawVersion = "1.0.3",
    L.Draw = {},
    L.drawLocal = {
        draw: {
            toolbar: {
                actions: {
                    title: "Cancel drawing",
                    text: "Cancel"
                },
                finish: {
                    title: "Finish drawing",
                    text: "Finish"
                },
                undo: {
                    title: "Delete last point drawn",
                    text: "Delete last point"
                },
                buttons: {
                    polyline: "<span localization-key=\"leafletDrawToolbarButtonsPolyline\"></span>",
                    polygon: "Draw a polygon",
                    rectangle: "Draw a rectangle",
                    circle: "Draw a circle",
                    marker: "Draw a marker",
                    circlemarker: "Draw a circlemarker"
                }
            },
            handlers: {
                circle: {
                    tooltip: {
                        start: "Click and drag to draw circle."
                    },
                    radius: "Radius"
                },
                circlemarker: {
                    tooltip: {
                        start: "Click map to place circle marker."
                    }
                },
                marker: {
                    tooltip: {
                        start: "Click map to place marker."
                    }
                },
                polygon: {
                    tooltip: {
                        start: "Click to start drawing shape.",
                        cont: "Click to continue drawing shape.",
                        end: "Click first point to close this shape."
                    }
                },
                polyline: {
                    error: "<strong>Error:</strong> shape edges cannot cross!",
                    tooltip: {
                        start: "Click to start drawing line.",
                        cont: "Click to continue drawing line.",
                        end: "Click last point to finish line."
                    }
                },
                rectangle: {
                    tooltip: {
                        start: "Click and drag to draw rectangle."
                    }
                },
                simpleshape: {
                    tooltip: {
                        end: "Release mouse to finish drawing."
                    }
                }
            }
        },
        edit: {
            toolbar: {
                actions: {
                    save: {
                        title: "Save changes",
                        text: "Save"
                    },
                    cancel: {
                        title: "Cancel editing, discards all changes",
                        text: "Cancel"
                    },
                    clearAll: {
                        title: "Clear all layers",
                        text: "Clear All"
                    }
                },
                buttons: {
                    edit: "Edit layers",
                    editDisabled: "No layers to edit",
                    remove: "Delete layers",
                    removeDisabled: "No layers to delete"
                }
            },
            handlers: {
                edit: {
                    tooltip: {
                        text: "Drag handles or markers to edit features.",
                        subtext: "Click cancel to undo changes."
                    }
                },
                remove: {
                    tooltip: {
                        text: "Click on a feature to remove."
                    }
                }
            }
        }
    },
    L.Draw.Event = {},
    L.Draw.Event.CREATED = "draw:created",
    L.Draw.Event.EDITED = "draw:edited",
    L.Draw.Event.DELETED = "draw:deleted",
    L.Draw.Event.DRAWSTART = "draw:drawstart",
    L.Draw.Event.DRAWSTOP = "draw:drawstop",
    L.Draw.Event.DRAWVERTEX = "draw:drawvertex",
    L.Draw.Event.EDITSTART = "draw:editstart",
    L.Draw.Event.EDITMOVE = "draw:editmove",
    L.Draw.Event.EDITRESIZE = "draw:editresize",
    L.Draw.Event.EDITVERTEX = "draw:editvertex",
    L.Draw.Event.EDITSTOP = "draw:editstop",
    L.Draw.Event.DELETESTART = "draw:deletestart",
    L.Draw.Event.DELETESTOP = "draw:deletestop",
    L.Draw.Event.TOOLBAROPENED = "draw:toolbaropened",
    L.Draw.Event.TOOLBARCLOSED = "draw:toolbarclosed",
    L.Draw.Event.MARKERCONTEXT = "draw:markercontext",
    L.Draw = L.Draw || {},
    L.Draw.Feature = L.Handler.extend({
        initialize: function (t, e) {
            this._map = t,
            this._container = t._container,
            this._overlayPane = t._panes.overlayPane,
            this._popupPane = t._panes.popupPane,
            e && e.shapeOptions && (e.shapeOptions = L.Util.extend({}, this.options.shapeOptions, e.shapeOptions)),
            L.setOptions(this, e);
            var i = L.version.split(".");
            1 === parseInt(i[0], 10) && parseInt(i[1], 10) >= 2 ? L.Draw.Feature.include(L.Evented.prototype) : L.Draw.Feature.include(L.Mixin.Events)
        },
        enable: function () {
            this._enabled || (L.Handler.prototype.enable.call(this), this.fire("enabled", {handler: this.type}), this._map.fire(L.Draw.Event.DRAWSTART, {layerType: this.type}))
        },
        disable: function () {
            this._enabled && (L.Handler.prototype.disable.call(this), this._map.fire(L.Draw.Event.DRAWSTOP, {layerType: this.type}), this.fire("disabled", {handler: this.type}))
        },
        addHooks: function () {
            var t = this._map;
            t && (L.DomUtil.disableTextSelection(), t.getContainer().focus(), this._tooltip = new L.Draw.Tooltip(this._map), L.DomEvent.on(this._container, "keyup", this._cancelDrawing, this))
        },
        removeHooks: function () {
            this._map && (L.DomUtil.enableTextSelection(), this._tooltip.dispose(), this._tooltip = null, L.DomEvent.off(this._container, "keyup", this._cancelDrawing, this))
        },
        setOptions: function (t) {
            L.setOptions(this, t)
        },
        _fireCreatedEvent: function (t) {
            this._map.fire(L.Draw.Event.CREATED, {
                layer: t,
                layerType: this.type
            })
        },
        _cancelDrawing: function (t) {
            27 === t.keyCode && (this._map.fire("draw:canceled", {layerType: this.type}), this.disable())
        }
    }),
    L.Draw.Polyline = L.Draw.Feature.extend({
        statics: {
            TYPE: "polyline"
        },
        Poly: L.Polyline,
        options: {
            allowIntersection: !0,
            repeatMode: !1,
            drawError: {
                color: "#b00b00",
                timeout: 2500
            },
            icon: new L.DivIcon(
                {
                    iconSize: new L.Point(8, 8),
                    className: "leaflet-div-icon leaflet-editing-icon"
                }
            ),
            touchIcon: new L.DivIcon(
                {
                    iconSize: new L.Point(20, 20),
                    className: "leaflet-div-icon leaflet-editing-icon leaflet-touch-icon"
                }
            ),
            guidelineDistance: 20,
            maxGuideLineLength: 4e3,
            shapeOptions: {
                stroke: !0,
                color: "#3388ff",
                weight: 4,
                opacity: .5,
                fill: !1,
                clickable: !0
            },
            metric: !0,
            feet: !0,
            nautic: !1,
            showLength: !0,
            zIndexOffset: 2e3,
            factor: 1,
            maxPoints: 0
        },
        initialize: function (t, e) {
            L.Browser.touch && (this.options.icon = this.options.touchIcon),
            this.options.drawError.message = L.drawLocal.draw.handlers.polyline.error,
            e && e.drawError && (e.drawError = L.Util.extend({}, this.options.drawError, e.drawError)),
            this.type = L.Draw.Polyline.TYPE,
            L.Draw.Feature.prototype.initialize.call(this, t, e)
        },
        addHooks: function () {
            L.Draw.Feature.prototype.addHooks.call(this),
            this._map && (this._markers =[], this._markerGroup = new L.LayerGroup, this._map.addLayer(this._markerGroup), this._poly = new L.Polyline([], this.options.shapeOptions), this._tooltip.updateContent(this._getTooltipText()), this._mouseMarker || (this._mouseMarker = L.marker(this._map.getCenter(), {
                icon: L.divIcon(
                    {
                        className: "leaflet-mouse-marker",
                        iconAnchor: [
                            20, 20
                        ],
                        iconSize: [40, 40]
                    }
                ),
                opacity: 0,
                zIndexOffset: this.options.zIndexOffset
            })), this._mouseMarker.on("mouseout", this._onMouseOut, this).on("mousemove", this._onMouseMove, this).on("mousedown", this._onMouseDown, this).on("mouseup", this._onMouseUp, this).addTo(this._map), this._map.on("mouseup", this._onMouseUp, this).on("mousemove", this._onMouseMove, this).on("zoomlevelschange", this._onZoomEnd, this).on("touchstart", this._onTouch, this).on("zoomend", this._onZoomEnd, this))
        },
        removeHooks: function () {
            L.Draw.Feature.prototype.removeHooks.call(this),
            this._clearHideErrorTimeout(),
            this._cleanUpShape(),
            this._map.removeLayer(this._markerGroup),
            delete this._markerGroup,
            delete this._markers,
            this._map.removeLayer(this._poly),
            delete this._poly,
            this._mouseMarker.off("mousedown", this._onMouseDown, this).off("mouseout", this._onMouseOut, this).off("mouseup", this._onMouseUp, this).off("mousemove", this._onMouseMove, this),
            this._map.removeLayer(this._mouseMarker),
            delete this._mouseMarker,
            this._clearGuides(),
            this._map.off("mouseup", this._onMouseUp, this).off("mousemove", this._onMouseMove, this).off("zoomlevelschange", this._onZoomEnd, this).off("zoomend", this._onZoomEnd, this).off("touchstart", this._onTouch, this).off("click", this._onTouch, this)
        },
        deleteLastVertex: function () {
            if (!(this._markers.length <= 1)) {
                var t = this._markers.pop(),
                    e = this._poly,
                    i = e.getLatLngs(),
                    o = i.splice(-1, 1)[0];
                this._poly.setLatLngs(i),
                this._markerGroup.removeLayer(t),
                e.getLatLngs().length < 2 && this._map.removeLayer(e),
                this._vertexChanged(o, !1)
            }
        },
        addVertex: function (t) {
            if (this._markers.length >= 2 && !this.options.allowIntersection && this._poly.newLatLngIntersects(t))
                return void this._showErrorTooltip();

            this._errorShown && this._hideErrorTooltip(),
            this._markers.push(this._createMarker(t)),
            this._poly.addLatLng(t),
            2 === this._poly.getLatLngs().length && this._map.addLayer(this._poly),
            this._vertexChanged(t, !0)
        },
        completeShape: function () {
            this._markers.length <= 1 || !this._shapeIsValid() || (this._fireCreatedEvent(), this.disable(), this.options.repeatMode && this.enable())
        },
        _finishShape: function () {
            var t = this._poly._defaultShape ? this._poly._defaultShape() : this._poly.getLatLngs(),
                e = this._poly.newLatLngIntersects(t[t.length - 1]);
            if (!this.options.allowIntersection && e || !this._shapeIsValid())
                return void this._showErrorTooltip();

            this._fireCreatedEvent(),
            this.disable(),
            this.options.repeatMode && this.enable()
        },
        _shapeIsValid: function () {
            return !0
        },
        _onZoomEnd: function () {
            null !== this._markers && this._updateGuide()
        },
        _onMouseMove: function (t) {
            var e = this._map.mouseEventToLayerPoint(t.originalEvent),
                i = this._map.layerPointToLatLng(e);
            this._currentLatLng = i,
            this._updateTooltip(i),
            this._updateGuide(e),
            this._mouseMarker.setLatLng(i),
            L.DomEvent.preventDefault(t.originalEvent)
        },
        _vertexChanged: function (t, e) {
            this._map.fire(L.Draw.Event.DRAWVERTEX, {layers: this._markerGroup}),
            this._updateFinishHandler(),
            this._updateRunningMeasure(t, e),
            this._clearGuides(),
            this._updateTooltip()
        },
        _onMouseDown: function (t) {
            if (!this._clickHandled && !this._touchHandled && !this._disableMarkers) {
                this._onMouseMove(t),
                this._clickHandled = !0,
                this._disableNewMarkers();
                var e = t.originalEvent,
                    i = e.clientX,
                    o = e.clientY;
                this._startPoint.call(this, i, o)
            }
        },
        _startPoint: function (t, e) {
            this._mouseDownOrigin = L.point(t, e)
        },
        _onMouseUp: function (t) {
            var e = t.originalEvent,
                i = e.clientX,
                o = e.clientY;
            this._endPoint.call(this, i, o, t),
            this._clickHandled = null
        },
        _endPoint: function (e, i, o) {
            if (this._mouseDownOrigin) {
                var a = L.point(e, i).distanceTo(this._mouseDownOrigin),
                    n = this._calculateFinishDistance(o.latlng);
                this.options.maxPoints > 1 && this.options.maxPoints == this._markers.length + 1 ? (this.addVertex(o.latlng), this._finishShape()) : n < 10 && L.Browser.touch ? this._finishShape() : Math.abs(a) < 9 * (t.devicePixelRatio || 1) && this.addVertex(o.latlng),
                this._enableNewMarkers()
            }
            this._mouseDownOrigin = null
        },
        _onTouch: function (t) {
            var e,
                i,
                o = t.originalEvent;
            ! o.touches || ! o.touches[0] || this._clickHandled || this._touchHandled || this._disableMarkers || (e = o.touches[0].clientX, i = o.touches[0].clientY, this._disableNewMarkers(), this._touchHandled =! 0, this._startPoint.call(this, e, i), this._endPoint.call(this, e, i, t), this._touchHandled = null),
            this._clickHandled = null
        },
        _onMouseOut: function () {
            this._tooltip && this._tooltip._onMouseOut.call(this._tooltip)
        },
        _calculateFinishDistance: function (t) {
            var e;
            if (this._markers.length > 0) {
                var i;
                if (this.type === L.Draw.Polyline.TYPE)
                    i = this._markers[this._markers.length - 1];
                 else {
                    if (this.type !== L.Draw.Polygon.TYPE)
                        return 1 / 0;

                    i = this._markers[0]
                }
                var o = this._map.latLngToContainerPoint(i.getLatLng()),
                    a = new L.Marker(t, {
                        icon: this.options.icon,
                        zIndexOffset: 2 *this.options.zIndexOffset
                    }),
                    n = this._map.latLngToContainerPoint(a.getLatLng());
                e = o.distanceTo(n)
            } else
                e = 1 / 0;

            return e
        },
        _updateFinishHandler: function () {
            var t = this._markers.length;
            t > 1 && this._markers[t - 1].on("click", this._finishShape, this),
            t > 2 && this._markers[t - 2].off("click", this._finishShape, this)
        },
        _createMarker: function (t) {
            var e = new L.Marker(t, {
                icon: this.options.icon,
                zIndexOffset: 2 *this.options.zIndexOffset
            });
            return this._markerGroup.addLayer(e),
            e
        },
        _updateGuide: function (t) {
            var e = this._markers ? this._markers.length : 0;
            e > 0 && (t = t || this._map.latLngToLayerPoint(this._currentLatLng), this._clearGuides(), this._drawGuide(this._map.latLngToLayerPoint(this._markers[e - 1].getLatLng()), t))
        },
        _updateTooltip: function (t) {
            var e = this._getTooltipText();
            t && this._tooltip.updatePosition(t),
            this._errorShown || this._tooltip.updateContent(e)
        },
        _drawGuide: function (t, e) {
            var i,
                o,
                a,
                n = Math.floor(Math.sqrt(Math.pow(e.x - t.x, 2) + Math.pow(e.y - t.y, 2))),
                s = this.options.guidelineDistance,
                r = this.options.maxGuideLineLength,
                l = n > r ? n - r : s;
            for (this._guidesContainer || (this._guidesContainer = L.DomUtil.create("div", "leaflet-draw-guides", this._overlayPane)); l < n; l += this.options.guidelineDistance)
                i = l / n,
                o = {
                    x: Math.floor(t.x * (1 - i) + i * e.x),
                    y: Math.floor(t.y * (1 - i) + i * e.y)
                },
                a = L.DomUtil.create("div", "leaflet-draw-guide-dash", this._guidesContainer),
                a.style.backgroundColor = this._errorShown ? this.options.drawError.color : this.options.shapeOptions.color,
                L.DomUtil.setPosition(a, o)

        },
        _updateGuideColor: function (t) {
            if (this._guidesContainer)
                for (var e = 0, i = this._guidesContainer.childNodes.length; e < i; e++)
                    this._guidesContainer.childNodes[e].style.backgroundColor = t


        },
        _clearGuides: function () {
            if (this._guidesContainer)
                for (; this._guidesContainer.firstChild;)
                    this._guidesContainer.removeChild(this._guidesContainer.firstChild)


        },
        _getTooltipText: function () {
            var t,
                e,
                i = this.options.showLength;
            return 0 === this._markers.length ? t = {
                text: L.drawLocal.draw.handlers.polyline.tooltip.start
            } : (e = i ? this._getMeasurementString() : "", t = 1 === this._markers.length ? {
                text: L.drawLocal.draw.handlers.polyline.tooltip.cont,
                subtext: e
            } : {
                text: L.drawLocal.draw.handlers.polyline.tooltip.end,
                subtext: e
            }),
            t
        },
        _updateRunningMeasure: function (t, e) {
            var i,
                o,
                a = this._markers.length;
            1 === this._markers.length ? this._measurementRunningTotal = 0 : (i = a - (e ? 2 : 1), o = L.GeometryUtil.isVersion07x() ? t.distanceTo(this._markers[i].getLatLng()) * (this.options.factor || 1) : this._map.distance(t, this._markers[i].getLatLng()) * (this.options.factor || 1), this._measurementRunningTotal += o * (e ? 1 : -1))
        },
        _getMeasurementString: function () {
            var t,
                e = this._currentLatLng,
                i = this._markers[this._markers.length - 1].getLatLng();
            return t = L.GeometryUtil.isVersion07x() ? i && e && e.distanceTo ? this._measurementRunningTotal + e.distanceTo(i) * (this.options.factor || 1) : this._measurementRunningTotal || 0 : i && e ? this._measurementRunningTotal + this._map.distance(e, i) * (this.options.factor || 1) : this._measurementRunningTotal || 0,
            L.GeometryUtil.readableDistance(t, this.options.metric, this.options.feet, this.options.nautic, this.options.precision)
        },
        _showErrorTooltip: function () {
            this._errorShown = !0,
            this._tooltip.showAsError().updateContent({text: this.options.drawError.message}),
            this._updateGuideColor(this.options.drawError.color),
            this._poly.setStyle({color: this.options.drawError.color}),
            this._clearHideErrorTimeout(),
            this._hideErrorTimeout = setTimeout(L.Util.bind(this._hideErrorTooltip, this), this.options.drawError.timeout)
        },
        _hideErrorTooltip: function () {
            this._errorShown = !1,
            this._clearHideErrorTimeout(),
            this._tooltip.removeError().updateContent(this._getTooltipText()),
            this._updateGuideColor(this.options.shapeOptions.color),
            this._poly.setStyle({color: this.options.shapeOptions.color})
        },
        _clearHideErrorTimeout: function () {
            this._hideErrorTimeout && (clearTimeout(this._hideErrorTimeout), this._hideErrorTimeout = null)
        },
        _disableNewMarkers: function () {
            this._disableMarkers = !0
        },
        _enableNewMarkers: function () {
            setTimeout(function () {
                this._disableMarkers = !1
            }.bind(this), 50)
        },
        _cleanUpShape: function () {
            this._markers.length > 1 && this._markers[this._markers.length - 1].off("click", this._finishShape, this)
        },
        _fireCreatedEvent: function () {
            var t = new this.Poly(this._poly.getLatLngs(), this.options.shapeOptions);
            L.Draw.Feature.prototype._fireCreatedEvent.call(this, t)
        }
    }),
    L.Draw.Polygon = L.Draw.Polyline.extend({
        statics: {
            TYPE: "polygon"
        },
        Poly: L.Polygon,
        options: {
            showArea: !1,
            showLength: !1,
            shapeOptions: {
                stroke: !0,
                color: "#3388ff",
                weight: 4,
                opacity: .5,
                fill: !0,
                fillColor: null,
                fillOpacity: .2,
                clickable: !0
            },
            metric: !0,
            feet: !0,
            nautic: !1,
            precision: {}
        },
        initialize: function (t, e) {
            L.Draw.Polyline.prototype.initialize.call(this, t, e),
            this.type = L.Draw.Polygon.TYPE
        },
        _updateFinishHandler: function () {
            var t = this._markers.length;
            1 === t && this._markers[0].on("click", this._finishShape, this),
            t > 2 && (this._markers[t - 1].on("dblclick", this._finishShape, this), t > 3 && this._markers[t - 2].off("dblclick", this._finishShape, this))
        },
        _getTooltipText: function () {
            var t,
                e;
            return 0 === this._markers.length ? t = L.drawLocal.draw.handlers.polygon.tooltip.start : this._markers.length < 3 ? (t = L.drawLocal.draw.handlers.polygon.tooltip.cont, e = this._getMeasurementString()) : (t = L.drawLocal.draw.handlers.polygon.tooltip.end, e = this._getMeasurementString()), {
                text: t,
                subtext: e
            }
        },
        _getMeasurementString: function () {
            var t = this._area,
                e = "";
            return t || this.options.showLength ? (this.options.showLength && (e = L.Draw.Polyline.prototype._getMeasurementString.call(this)), t && (e += "<br>" + L.GeometryUtil.readableArea(t, this.options.metric, this.options.precision)), e) : null
        },
        _shapeIsValid: function () {
            return this._markers.length >= 3
        },
        _vertexChanged: function (t, e) {
            var i;
            !this.options.allowIntersection && this.options.showArea && (i = this._poly.getLatLngs(), this._area = L.GeometryUtil.geodesicArea(i)),
            L.Draw.Polyline.prototype._vertexChanged.call(this, t, e)
        },
        _cleanUpShape: function () {
            var t = this._markers.length;
            t > 0 && (this._markers[0].off("click", this._finishShape, this), t > 2 && this._markers[t - 1].off("dblclick", this._finishShape, this))
        }
    }),
    L.SimpleShape = {},
    L.Draw.SimpleShape = L.Draw.Feature.extend({
        options: {
            repeatMode: !1
        },
        initialize: function (t, e) {
            this._endLabelText = L.drawLocal.draw.handlers.simpleshape.tooltip.end,
            L.Draw.Feature.prototype.initialize.call(this, t, e)
        },
        addHooks: function () {
            L.Draw.Feature.prototype.addHooks.call(this),
            this._map && (this._mapDraggable = this._map.dragging.enabled(), this._mapDraggable && this._map.dragging.disable(), this._container.style.cursor = "crosshair", this._tooltip.updateContent({text: this._initialLabelText}), this._map.on("mousedown", this._onMouseDown, this).on("mousemove", this._onMouseMove, this).on("touchstart", this._onMouseDown, this).on("touchmove", this._onMouseMove, this), e.addEventListener("touchstart", L.DomEvent.preventDefault, {
                passive: !1
            }))
        },
        removeHooks: function () {
            L.Draw.Feature.prototype.removeHooks.call(this),
            this._map && (this._mapDraggable && this._map.dragging.enable(), this._container.style.cursor = "", this._map.off("mousedown", this._onMouseDown, this).off("mousemove", this._onMouseMove, this).off("touchstart", this._onMouseDown, this).off("touchmove", this._onMouseMove, this), L.DomEvent.off(e, "mouseup", this._onMouseUp, this), L.DomEvent.off(e, "touchend", this._onMouseUp, this), e.removeEventListener("touchstart", L.DomEvent.preventDefault), this._shape && (this._map.removeLayer(this._shape), delete this._shape)),
            this._isDrawing = !1
        },
        _getTooltipText: function () {
            return {text: this._endLabelText}
        },
        _onMouseDown: function (t) {
            this._isDrawing = !0,
            this._startLatLng = t.latlng,
            L.DomEvent.on(e, "mouseup", this._onMouseUp, this).on(e, "touchend", this._onMouseUp, this).preventDefault(t.originalEvent)
        },
        _onMouseMove: function (t) {
            var e = t.latlng;
            this._tooltip.updatePosition(e),
            this._isDrawing && (this._tooltip.updateContent(this._getTooltipText()), this._drawShape(e))
        },
        _onMouseUp: function () {
            this._shape && this._fireCreatedEvent(),
            this.disable(),
            this.options.repeatMode && this.enable()
        }
    }),
    L.Draw.Rectangle = L.Draw.SimpleShape.extend({
        statics: {
            TYPE: "rectangle"
        },
        options: {
            shapeOptions: {
                stroke: !0,
                color: "#3388ff",
                weight: 4,
                opacity: .5,
                fill: !0,
                fillColor: null,
                fillOpacity: .2,
                clickable: !0
            },
            showArea: !0,
            metric: !0
        },
        initialize: function (t, e) {
            this.type = L.Draw.Rectangle.TYPE,
            this._initialLabelText = L.drawLocal.draw.handlers.rectangle.tooltip.start,
            L.Draw.SimpleShape.prototype.initialize.call(this, t, e)
        },
        disable: function () {
            this._enabled && (this._isCurrentlyTwoClickDrawing =! 1, L.Draw.SimpleShape.prototype.disable.call(this))
        },
        _onMouseUp: function (t) {
            if (!this._shape && !this._isCurrentlyTwoClickDrawing)
                return void(this._isCurrentlyTwoClickDrawing = !0);

            this._isCurrentlyTwoClickDrawing && ! o(t.target, "leaflet-pane") || L.Draw.SimpleShape.prototype._onMouseUp.call(this)
        },
        _drawShape: function (t) {
            this._shape ? this._shape.setBounds(new L.LatLngBounds(this._startLatLng, t)) : (this._shape = new L.Rectangle(new L.LatLngBounds(this._startLatLng, t), this.options.shapeOptions), this._map.addLayer(this._shape))
        },
        _fireCreatedEvent: function () {
            var t = new L.Rectangle(this._shape.getBounds(), this.options.shapeOptions);
            L.Draw.SimpleShape.prototype._fireCreatedEvent.call(this, t)
        },
        _getTooltipText: function () {
            var t,
                e,
                i,
                o = L.Draw.SimpleShape.prototype._getTooltipText.call(this),
                a = this._shape,
                n = this.options.showArea;
            return a && (t = this._shape._defaultShape ? this._shape._defaultShape() : this._shape.getLatLngs(), e = L.GeometryUtil.geodesicArea(t), i = n ? L.GeometryUtil.readableArea(e, this.options.metric) : ""), {
                text: o.text,
                subtext: i
            }
        }
    }),
    L.Draw.Marker = L.Draw.Feature.extend({
        statics: {
            TYPE: "marker"
        },
        options: {
            icon: new L.Icon.Default,
            repeatMode: !1,
            zIndexOffset: 2e3
        },
        initialize: function (t, e) {
            this.type = L.Draw.Marker.TYPE,
            this._initialLabelText = L.drawLocal.draw.handlers.marker.tooltip.start,
            L.Draw.Feature.prototype.initialize.call(this, t, e)
        },
        addHooks: function () {
            L.Draw.Feature.prototype.addHooks.call(this),
            this._map && (this._tooltip.updateContent({text: this._initialLabelText}), this._mouseMarker || (this._mouseMarker = L.marker(this._map.getCenter(), {
                icon: L.divIcon(
                    {
                        className: "leaflet-mouse-marker",
                        iconAnchor: [
                            20, 20
                        ],
                        iconSize: [40, 40]
                    }
                ),
                opacity: 0,
                zIndexOffset: this.options.zIndexOffset
            })), this._mouseMarker.on("click", this._onClick, this).addTo(this._map), this._map.on("mousemove", this._onMouseMove, this), this._map.on("click", this._onTouch, this))
        },
        removeHooks: function () {
            L.Draw.Feature.prototype.removeHooks.call(this),
            this._map && (this._map.off("click", this._onClick, this).off("click", this._onTouch, this), this._marker && (this._marker.off("click", this._onClick, this), this._map.removeLayer(this._marker), delete this._marker), this._mouseMarker.off("click", this._onClick, this), this._map.removeLayer(this._mouseMarker), delete this._mouseMarker, this._map.off("mousemove", this._onMouseMove, this))
        },
        _onMouseMove: function (t) {
            var e = t.latlng;
            this._tooltip.updatePosition(e),
            this._mouseMarker.setLatLng(e),
            this._marker ? (e = this._mouseMarker.getLatLng(), this._marker.setLatLng(e)) : (this._marker = this._createMarker(e), this._marker.on("click", this._onClick, this), this._map.on("click", this._onClick, this).addLayer(this._marker))
        },
        _createMarker: function (t) {
            return new L.Marker(t, {
                icon: this.options.icon,
                zIndexOffset: this.options.zIndexOffset
            })
        },
        _onClick: function () {
            this._fireCreatedEvent(),
            this.disable(),
            this.options.repeatMode && this.enable()
        },
        _onTouch: function (t) {
            this._onMouseMove(t),
            this._onClick()
        },
        _fireCreatedEvent: function () {
            var t = new L.Marker.Touch(this._marker.getLatLng(), {icon: this.options.icon});
            L.Draw.Feature.prototype._fireCreatedEvent.call(this, t)
        }
    }),
    L.Draw.CircleMarker = L.Draw.Marker.extend({
        statics: {
            TYPE: "circlemarker"
        },
        options: {
            stroke: !0,
            color: "#3388ff",
            weight: 4,
            opacity: .5,
            fill: !0,
            fillColor: null,
            fillOpacity: .2,
            clickable: !0,
            zIndexOffset: 2e3
        },
        initialize: function (t, e) {
            this.type = L.Draw.CircleMarker.TYPE,
            this._initialLabelText = L.drawLocal.draw.handlers.circlemarker.tooltip.start,
            L.Draw.Feature.prototype.initialize.call(this, t, e)
        },
        _fireCreatedEvent: function () {
            var t = new L.CircleMarker(this._marker.getLatLng(), this.options);
            L.Draw.Feature.prototype._fireCreatedEvent.call(this, t)
        },
        _createMarker: function (t) {
            return new L.CircleMarker(t, this.options)
        }
    }),
    L.Draw.Circle = L.Draw.SimpleShape.extend({
        statics: {
            TYPE: "circle"
        },
        options: {
            shapeOptions: {
                stroke: !0,
                color: "#3388ff",
                weight: 4,
                opacity: .5,
                fill: !0,
                fillColor: null,
                fillOpacity: .2,
                clickable: !0
            },
            showRadius: !0,
            metric: !0,
            feet: !0,
            nautic: !1
        },
        initialize: function (t, e) {
            this.type = L.Draw.Circle.TYPE,
            this._initialLabelText = L.drawLocal.draw.handlers.circle.tooltip.start,
            L.Draw.SimpleShape.prototype.initialize.call(this, t, e)
        },
        _drawShape: function (t) {
            if (L.GeometryUtil.isVersion07x())
                var e = this._startLatLng.distanceTo(t);
             else
                var e = this._map.distance(this._startLatLng, t);

            this._shape ? this._shape.setRadius(e) : (this._shape = new L.Circle(this._startLatLng, e, this.options.shapeOptions), this._map.addLayer(this._shape))
        },
        _fireCreatedEvent: function () {
            var t = new L.Circle(this._startLatLng, this._shape.getRadius(), this.options.shapeOptions);
            L.Draw.SimpleShape.prototype._fireCreatedEvent.call(this, t)
        },
        _onMouseMove: function (t) {
            var e,
                i = t.latlng,
                o = this.options.showRadius,
                a = this.options.metric;
            if (this._tooltip.updatePosition(i), this._isDrawing) {
                this._drawShape(i),
                e = this._shape.getRadius().toFixed(1);
                var n = "";
                o && (n = L.drawLocal.draw.handlers.circle.radius + ": " + L.GeometryUtil.readableDistance(e, a, this.options.feet, this.options.nautic)),
                this._tooltip.updateContent({text: this._endLabelText, subtext: n})
            }
        }
    }),
    L.Edit = L.Edit || {},
    L.Edit.Marker = L.Handler.extend({
        initialize: function (t, e) {
            this._marker = t,
            L.setOptions(this, e)
        },
        addHooks: function () {
            var t = this._marker;
            t.dragging.enable(),
            t.on("dragend", this._onDragEnd, t),
            this._toggleMarkerHighlight()
        },
        removeHooks: function () {
            var t = this._marker;
            t.dragging.disable(),
            t.off("dragend", this._onDragEnd, t),
            this._toggleMarkerHighlight()
        },
        _onDragEnd: function (t) {
            var e = t.target;
            e.edited = !0,
            this._map.fire(L.Draw.Event.EDITMOVE, {layer: e})
        },
        _toggleMarkerHighlight: function () {
            var t = this._marker._icon;
            t && (t.style.display = "none", L.DomUtil.hasClass(t, "leaflet-edit-marker-selected") ? (L.DomUtil.removeClass(t, "leaflet-edit-marker-selected"), this._offsetMarker(t, -4)) : (L.DomUtil.addClass(t, "leaflet-edit-marker-selected"), this._offsetMarker(t, 4)), t.style.display = "")
        },
        _offsetMarker: function (t, e) {
            var i = parseInt(t.style.marginTop, 10) - e,
                o = parseInt(t.style.marginLeft, 10) - e;
            t.style.marginTop = i + "px",
            t.style.marginLeft = o + "px"
        }
    }),
    L.Marker.addInitHook(function () {
        L.Edit.Marker && (this.editing = new L.Edit.Marker(this), this.options.editable && this.editing.enable())
    }),
    L.Edit = L.Edit || {},
    L.Edit.Poly = L.Handler.extend({
        initialize: function (t) {
            this.latlngs = [t._latlngs],
            t._holes && (this.latlngs = this.latlngs.concat(t._holes)),
            this._poly = t,
            this._poly.on("revert-edited", this._updateLatLngs, this)
        },
        _defaultShape: function () {
            return L.Polyline._flat ? L.Polyline._flat(this._poly._latlngs) ? this._poly._latlngs : this._poly._latlngs[0] : this._poly._latlngs
        },
        _eachVertexHandler: function (t) {
            for (var e = 0; e < this._verticesHandlers.length; e++)
                t(this._verticesHandlers[e])

        },
        addHooks: function () {
            this._initHandlers(),
            this._eachVertexHandler(function (t) {
                t.addHooks()
            })
        },
        removeHooks: function () {
            this._eachVertexHandler(function (t) {
                t.removeHooks()
            })
        },
        updateMarkers: function () {
            this._eachVertexHandler(function (t) {
                t.updateMarkers()
            })
        },
        _initHandlers: function () {
            this._verticesHandlers = [];
            for (var t = 0; t < this.latlngs.length; t++)
                this._verticesHandlers.push(new L.Edit.PolyVerticesEdit(this._poly, this.latlngs[t], this._poly.options.poly))

        },
        _updateLatLngs: function (t) {
            this.latlngs = [t.layer._latlngs],
            t.layer._holes && (this.latlngs = this.latlngs.concat(t.layer._holes))
        }
    }),
    L.Edit.PolyVerticesEdit = L.Handler.extend({
        options: {
            icon: new L.DivIcon(
                {
                    iconSize: new L.Point(8, 8),
                    className: "leaflet-div-icon leaflet-editing-icon"
                }
            ),
            touchIcon: new L.DivIcon(
                {
                    iconSize: new L.Point(20, 20),
                    className: "leaflet-div-icon leaflet-editing-icon leaflet-touch-icon"
                }
            ),
            drawError: {
                color: "#b00b00",
                timeout: 1e3
            }
        },
        initialize: function (t, e, i) {
            L.Browser.touch && (this.options.icon = this.options.touchIcon),
            this._poly = t,
            i && i.drawError && (i.drawError = L.Util.extend({}, this.options.drawError, i.drawError)),
            this._latlngs = e,
            L.setOptions(this, i)
        },
        _defaultShape: function () {
            return L.Polyline._flat ? L.Polyline._flat(this._latlngs) ? this._latlngs : this._latlngs[0] : this._latlngs
        },
        addHooks: function () {
            var t = this._poly,
                e = t._path;
            t instanceof L.Polygon || (t.options.fill =! 1, t.options.editing && (t.options.editing.fill =! 1)),
            e && t.options.editing && t.options.editing.className && (t.options.original.className && t.options.original.className.split(" ").forEach(function (t) {
                L.DomUtil.removeClass(e, t)
            }), t.options.editing.className.split(" ").forEach(function (t) {
                L.DomUtil.addClass(e, t)
            })),
            t.setStyle(t.options.editing),
            this._poly._map && (this._map = this._poly._map, this._markerGroup || this._initMarkers(), this._poly._map.addLayer(this._markerGroup))
        },
        removeHooks: function () {
            var t = this._poly,
                e = t._path;
            e && t.options.editing && t.options.editing.className && (t.options.editing.className.split(" ").forEach(function (t) {
                L.DomUtil.removeClass(e, t)
            }), t.options.original.className && t.options.original.className.split(" ").forEach(function (t) {
                L.DomUtil.addClass(e, t)
            })),
            t.setStyle(t.options.original),
            t._map && (t._map.removeLayer(this._markerGroup), delete this._markerGroup, delete this._markers)
        },
        updateMarkers: function () {
            this._markerGroup.clearLayers(),
            this._initMarkers()
        },
        _initMarkers: function () {
            this._markerGroup || (this._markerGroup = new L.LayerGroup),
            this._markers = [];
            var t,
                e,
                i,
                o,
                a = this._defaultShape();
            for (t = 0, i = a.length; t < i; t++)
                o = this._createMarker(a[t], t),
                o.on("click", this._onMarkerClick, this),
                o.on("contextmenu", this._onContextMenu, this),
                this._markers.push(o);

            var n,
                s;
            for (t = 0, e = i - 1; t < i; e = t++)
                (0 !== t || L.Polygon && this._poly instanceof L.Polygon) && (n = this._markers[e], s = this._markers[t], this._createMiddleMarker(n, s), this._updatePrevNext(n, s))

        },
        _createMarker: function (t, e) {
            var i = new L.Marker.Touch(t, {
                draggable: !0,
                icon: this.options.icon
            });
            return i._origLatLng = t,
            i._index = e,
            i.on("dragstart", this._onMarkerDragStart, this).on("drag", this._onMarkerDrag, this).on("dragend", this._fireEdit, this).on("touchmove", this._onTouchMove, this).on("touchend", this._fireEdit, this).on("MSPointerMove", this._onTouchMove, this).on("MSPointerUp", this._fireEdit, this),
            this._markerGroup.addLayer(i),
            i
        },
        _onMarkerDragStart: function () {
            this._poly.fire("editstart")
        },
        _spliceLatLngs: function () {
            var t = this._defaultShape(),
                e = [].splice.apply(t, arguments);
            return this._poly._convertLatLngs(t, !0),
            this._poly.redraw(),
            e
        },
        _removeMarker: function (t) {
            var e = t._index;
            this._markerGroup.removeLayer(t),
            this._markers.splice(e, 1),
            this._spliceLatLngs(e, 1),
            this._updateIndexes(e, -1),
            t.off("dragstart", this._onMarkerDragStart, this).off("drag", this._onMarkerDrag, this).off("dragend", this._fireEdit, this).off("touchmove", this._onMarkerDrag, this).off("touchend", this._fireEdit, this).off("click", this._onMarkerClick, this).off("MSPointerMove", this._onTouchMove, this).off("MSPointerUp", this._fireEdit, this)
        },
        _fireEdit: function () {
            this._poly.edited = !0,
            this._poly.fire("edit"),
            this._poly._map.fire(L.Draw.Event.EDITVERTEX, {
                layers: this._markerGroup,
                poly: this._poly
            })
        },
        _onMarkerDrag: function (t) {
            var e = t.target,
                i = this._poly,
                o = L.LatLngUtil.cloneLatLng(e._origLatLng);
            if (L.extend(e._origLatLng, e._latlng), i.options.poly) {
                var a = i._map._editTooltip;
                if (! i.options.poly.allowIntersection && i.intersects()) {
                    L.extend(e._origLatLng, o),
                    e.setLatLng(o);
                    var n = i.options.color;
                    i.setStyle({color: this.options.drawError.color}),
                    a && a.updateContent({text: L.drawLocal.draw.handlers.polyline.error}),
                    setTimeout(function () {
                        i.setStyle({color: n}),
                        a && a.updateContent({text: L.drawLocal.edit.handlers.edit.tooltip.text, subtext: L.drawLocal.edit.handlers.edit.tooltip.subtext})
                    }, 1e3)
                }
            }
            e._middleLeft && e._middleLeft.setLatLng(this._getMiddleLatLng(e._prev, e)),
            e._middleRight && e._middleRight.setLatLng(this._getMiddleLatLng(e, e._next)),
            this._poly._bounds._southWest = L.latLng(1 / 0, 1 / 0),
            this._poly._bounds._northEast = L.latLng(-1 / 0, -1 / 0);
            var s = this._poly.getLatLngs();
            this._poly._convertLatLngs(s, !0),
            this._poly.redraw(),
            this._poly.fire("editdrag")
        },
        _onMarkerClick: function (t) {
            var e = L.Polygon && this._poly instanceof L.Polygon ? 4 : 3,
                i = t.target;
            this._defaultShape().length < e || (this._removeMarker(i), this._updatePrevNext(i._prev, i._next), i._middleLeft && this._markerGroup.removeLayer(i._middleLeft), i._middleRight && this._markerGroup.removeLayer(i._middleRight), i._prev && i._next ? this._createMiddleMarker(i._prev, i._next) : i._prev ? i._next || (i._prev._middleRight = null) : i._next._middleLeft = null, this._fireEdit())
        },
        _onContextMenu: function (t) {
            var e = t.target;
            this._poly;
            this._poly._map.fire(L.Draw.Event.MARKERCONTEXT, {
                marker: e,
                layers: this._markerGroup,
                poly: this._poly
            }),
            L.DomEvent.stopPropagation
        },
        _onTouchMove: function (t) {
            var e = this._map.mouseEventToLayerPoint(t.originalEvent.touches[0]),
                i = this._map.layerPointToLatLng(e),
                o = t.target;
            L.extend(o._origLatLng, i),
            o._middleLeft && o._middleLeft.setLatLng(this._getMiddleLatLng(o._prev, o)),
            o._middleRight && o._middleRight.setLatLng(this._getMiddleLatLng(o, o._next)),
            this._poly.redraw(),
            this.updateMarkers()
        },
        _updateIndexes: function (t, e) {
            this._markerGroup.eachLayer(function (i) {
                i._index > t && (i._index += e)
            })
        },
        _createMiddleMarker: function (t, e) {
            var i,
                o,
                a,
                n = this._getMiddleLatLng(t, e),
                s = this._createMarker(n);
            s.setOpacity(.6),
            t._middleRight = e._middleLeft = s,
            o = function () {
                s.off("touchmove", o, this);
                var a = e._index;
                s._index = a,
                s.off("click", i, this).on("click", this._onMarkerClick, this),
                n.lat = s.getLatLng().lat,
                n.lng = s.getLatLng().lng,
                this._spliceLatLngs(a, 0, n),
                this._markers.splice(a, 0, s),
                s.setOpacity(1),
                this._updateIndexes(a, 1),
                e._index ++,
                this._updatePrevNext(t, s),
                this._updatePrevNext(s, e),
                this._poly.fire("editstart")
            },
            a = function () {
                s.off("dragstart", o, this),
                s.off("dragend", a, this),
                s.off("touchmove", o, this),
                this._createMiddleMarker(t, s),
                this._createMiddleMarker(s, e)
            },
            i = function () {
                o.call(this),
                a.call(this),
                this._fireEdit()
            },
            s.on("click", i, this).on("dragstart", o, this).on("dragend", a, this).on("touchmove", o, this),
            this._markerGroup.addLayer(s)
        },
        _updatePrevNext: function (t, e) {
            t && (t._next = e),
            e && (e._prev = t)
        },
        _getMiddleLatLng: function (t, e) {
            var i = this._poly._map,
                o = i.project(t.getLatLng()),
                a = i.project(e.getLatLng());
            return i.unproject(o._add(a)._divideBy(2))
        }
    }),
    L.Polyline.addInitHook(function () {
        this.editing || (L.Edit.Poly && (this.editing = new L.Edit.Poly(this), this.options.editable && this.editing.enable()), this.on("add", function () {
            this.editing && this.editing.enabled() && this.editing.addHooks()
        }), this.on("remove", function () {
            this.editing && this.editing.enabled() && this.editing.removeHooks()
        }))
    }),
    L.Edit = L.Edit || {},
    L.Edit.SimpleShape = L.Handler.extend({
        options: {
            moveIcon: new L.DivIcon(
                {
                    iconSize: new L.Point(8, 8),
                    className: "leaflet-div-icon leaflet-editing-icon leaflet-edit-move"
                }
            ),
            resizeIcon: new L.DivIcon(
                {
                    iconSize: new L.Point(8, 8),
                    className: "leaflet-div-icon leaflet-editing-icon leaflet-edit-resize"
                }
            ),
            touchMoveIcon: new L.DivIcon(
                {
                    iconSize: new L.Point(20, 20),
                    className: "leaflet-div-icon leaflet-editing-icon leaflet-edit-move leaflet-touch-icon"
                }
            ),
            touchResizeIcon: new L.DivIcon(
                {
                    iconSize: new L.Point(20, 20),
                    className: "leaflet-div-icon leaflet-editing-icon leaflet-edit-resize leaflet-touch-icon"
                }
            )
        },
        initialize: function (t, e) {
            L.Browser.touch && (this.options.moveIcon = this.options.touchMoveIcon, this.options.resizeIcon = this.options.touchResizeIcon),
            this._shape = t,
            L.Util.setOptions(this, e)
        },
        addHooks: function () {
            var t = this._shape;
            this._shape._map && (this._map = this._shape._map, t.setStyle(t.options.editing), t._map && (this._map = t._map, this._markerGroup || this._initMarkers(), this._map.addLayer(this._markerGroup)))
        },
        removeHooks: function () {
            var t = this._shape;
            if (t.setStyle(t.options.original), t._map) {
                this._unbindMarker(this._moveMarker);
                for (var e = 0, i = this._resizeMarkers.length; e < i; e++)
                    this._unbindMarker(this._resizeMarkers[e]);

                this._resizeMarkers = null,
                this._map.removeLayer(this._markerGroup),
                delete this._markerGroup
            }
            this._map = null
        },
        updateMarkers: function () {
            this._markerGroup.clearLayers(),
            this._initMarkers()
        },
        _initMarkers: function () {
            this._markerGroup || (this._markerGroup = new L.LayerGroup),
            this._createMoveMarker(),
            this._createResizeMarker()
        },
        _createMoveMarker: function () {},
        _createResizeMarker: function () {},
        _createMarker: function (t, e) {
            var i = new L.Marker.Touch(t, {
                draggable: !0,
                icon: e,
                zIndexOffset: 10
            });
            return this._bindMarker(i),
            this._markerGroup.addLayer(i),
            i
        },
        _bindMarker: function (t) {
            t.on("dragstart", this._onMarkerDragStart, this).on("drag", this._onMarkerDrag, this).on("dragend", this._onMarkerDragEnd, this).on("touchstart", this._onTouchStart, this).on("touchmove", this._onTouchMove, this).on("MSPointerMove", this._onTouchMove, this).on("touchend", this._onTouchEnd, this).on("MSPointerUp", this._onTouchEnd, this)
        },
        _unbindMarker: function (t) {
            t.off("dragstart", this._onMarkerDragStart, this).off("drag", this._onMarkerDrag, this).off("dragend", this._onMarkerDragEnd, this).off("touchstart", this._onTouchStart, this).off("touchmove", this._onTouchMove, this).off("MSPointerMove", this._onTouchMove, this).off("touchend", this._onTouchEnd, this).off("MSPointerUp", this._onTouchEnd, this)
        },
        _onMarkerDragStart: function (t) {
            t.target.setOpacity(0),
            this._shape.fire("editstart")
        },
        _fireEdit: function () {
            this._shape.edited = !0,
            this._shape.fire("edit")
        },
        _onMarkerDrag: function (t) {
            var e = t.target,
                i = e.getLatLng();
            e === this._moveMarker ? this._move(i) : this._resize(i),
            this._shape.redraw(),
            this._shape.fire("editdrag")
        },
        _onMarkerDragEnd: function (t) {
            t.target.setOpacity(1),
            this._fireEdit()
        },
        _onTouchStart: function (t) {
            if (L.Edit.SimpleShape.prototype._onMarkerDragStart.call(this, t), "function" == typeof this._getCorners) {
                var e = this._getCorners(),
                    i = t.target,
                    o = i._cornerIndex;
                i.setOpacity(0),
                this._oppositeCorner = e[(o + 2) % 4],
                this._toggleCornerMarkers(0, o)
            }
            this._shape.fire("editstart")
        },
        _onTouchMove: function (t) {
            var e = this._map.mouseEventToLayerPoint(t.originalEvent.touches[0]),
                i = this._map.layerPointToLatLng(e);
            return t.target === this._moveMarker ? this._move(i) : this._resize(i),
            this._shape.redraw(),
            !1
        },
        _onTouchEnd: function (t) {
            t.target.setOpacity(1),
            this.updateMarkers(),
            this._fireEdit()
        },
        _move: function () {},
        _resize: function () {}
    }),
    L.Edit = L.Edit || {},
    L.Edit.Rectangle = L.Edit.SimpleShape.extend({
        _createMoveMarker: function () {
            var t = this._shape.getBounds(),
                e = t.getCenter();
            this._moveMarker = this._createMarker(e, this.options.moveIcon)
        },
        _createResizeMarker: function () {
            var t = this._getCorners();
            this._resizeMarkers = [];
            for (var e = 0, i = t.length; e < i; e++)
                this._resizeMarkers.push(this._createMarker(t[e], this.options.resizeIcon)),
                this._resizeMarkers[e]._cornerIndex = e

        },
        _onMarkerDragStart: function (t) {
            L.Edit.SimpleShape.prototype._onMarkerDragStart.call(this, t);
            var e = this._getCorners(),
                i = t.target,
                o = i._cornerIndex;
            this._oppositeCorner = e[(o + 2) % 4],
            this._toggleCornerMarkers(0, o)
        },
        _onMarkerDragEnd: function (t) {
            var e,
                i,
                o = t.target;
            o === this._moveMarker && (e = this._shape.getBounds(), i = e.getCenter(), o.setLatLng(i)),
            this._toggleCornerMarkers(1),
            this._repositionCornerMarkers(),
            L.Edit.SimpleShape.prototype._onMarkerDragEnd.call(this, t)
        },
        _move: function (t) {
            for (var e, i = this._shape._defaultShape ? this._shape._defaultShape() : this._shape.getLatLngs(), o = this._shape.getBounds(), a = o.getCenter(), n =[], s = 0, r = i.length; s < r; s++)
                e = [
                    i[s].lat - a.lat,
                    i[s].lng - a.lng
                ],
                n.push([
                    t.lat + e[0],
                    t.lng + e[1]
                ]);

            this._shape.setLatLngs(n),
            this._repositionCornerMarkers(),
            this._map.fire(L.Draw.Event.EDITMOVE, {layer: this._shape})
        },
        _resize: function (t) {
            var e;
            this._shape.setBounds(L.latLngBounds(t, this._oppositeCorner)),
            e = this._shape.getBounds(),
            this._moveMarker.setLatLng(e.getCenter()),
            this._map.fire(L.Draw.Event.EDITRESIZE, {layer: this._shape})
        },
        _getCorners: function () {
            var t = this._shape.getBounds();
            return [t.getNorthWest(), t.getNorthEast(), t.getSouthEast(), t.getSouthWest()]
        },
        _toggleCornerMarkers: function (t) {
            for (var e = 0, i = this._resizeMarkers.length; e < i; e++)
                this._resizeMarkers[e].setOpacity(t)

        },
        _repositionCornerMarkers: function () {
            for (var t = this._getCorners(), e = 0, i = this._resizeMarkers.length; e < i; e++)
                this._resizeMarkers[e].setLatLng(t[e])

        }
    }),
    L.Rectangle.addInitHook(function () {
        L.Edit.Rectangle && (this.editing = new L.Edit.Rectangle(this), this.options.editable && this.editing.enable())
    }),
    L.Edit = L.Edit || {},
    L.Edit.CircleMarker = L.Edit.SimpleShape.extend({
        _createMoveMarker: function () {
            var t = this._shape.getLatLng();
            this._moveMarker = this._createMarker(t, this.options.moveIcon)
        },
        _createResizeMarker: function () {
            this._resizeMarkers = []
        },
        _move: function (t) {
            if (this._resizeMarkers.length) {
                var e = this._getResizeMarkerPoint(t);
                this._resizeMarkers[0].setLatLng(e)
            }
            this._shape.setLatLng(t),
            this._map.fire(L.Draw.Event.EDITMOVE, {layer: this._shape})
        }
    }),
    L.CircleMarker.addInitHook(function () {
        L.Edit.CircleMarker && (this.editing = new L.Edit.CircleMarker(this), this.options.editable && this.editing.enable()),
        this.on("add", function () {
            this.editing && this.editing.enabled() && this.editing.addHooks()
        }),
        this.on("remove", function () {
            this.editing && this.editing.enabled() && this.editing.removeHooks()
        })
    }),
    L.Edit = L.Edit || {},
    L.Edit.Circle = L.Edit.CircleMarker.extend({
        _createResizeMarker: function () {
            var t = this._shape.getLatLng(),
                e = this._getResizeMarkerPoint(t);
            this._resizeMarkers = [],
            this._resizeMarkers.push(this._createMarker(e, this.options.resizeIcon))
        },
        _getResizeMarkerPoint: function (t) {
            var e = this._shape._radius * Math.cos(Math.PI / 4),
                i = this._map.project(t);
            return this._map.unproject([
                i.x + e,
                i.y - e
            ])
        },
        _resize: function (t) {
            var e = this._moveMarker.getLatLng();
            L.GeometryUtil.isVersion07x() ? radius = e.distanceTo(t) : radius = this._map.distance(e, t),
            this._shape.setRadius(radius),
            this._map.editTooltip && this._map._editTooltip.updateContent({
                text: L.drawLocal.edit.handlers.edit.tooltip.subtext + "<br />" + L.drawLocal.edit.handlers.edit.tooltip.text,
                subtext: L.drawLocal.draw.handlers.circle.radius + ": " + L.GeometryUtil.readableDistance(radius, !0, this.options.feet, this.options.nautic)
            }),
            this._shape.setRadius(radius),
            this._map.fire(L.Draw.Event.EDITRESIZE, {layer: this._shape})
        }
    }),
    L.Circle.addInitHook(function () {
        L.Edit.Circle && (this.editing = new L.Edit.Circle(this), this.options.editable && this.editing.enable())
    }),
    L.Map.mergeOptions({
        touchExtend: !0
    }),
    L.Map.TouchExtend = L.Handler.extend({
        initialize: function (t) {
            this._map = t,
            this._container = t._container,
            this._pane = t._panes.overlayPane
        },
        addHooks: function () {
            L.DomEvent.on(this._container, "touchstart", this._onTouchStart, this),
            L.DomEvent.on(this._container, "touchend", this._onTouchEnd, this),
            L.DomEvent.on(this._container, "touchmove", this._onTouchMove, this),
            this._detectIE() ? (L.DomEvent.on(this._container, "MSPointerDown", this._onTouchStart, this), L.DomEvent.on(this._container, "MSPointerUp", this._onTouchEnd, this), L.DomEvent.on(this._container, "MSPointerMove", this._onTouchMove, this), L.DomEvent.on(this._container, "MSPointerCancel", this._onTouchCancel, this)) : (L.DomEvent.on(this._container, "touchcancel", this._onTouchCancel, this), L.DomEvent.on(this._container, "touchleave", this._onTouchLeave, this))
        },
        removeHooks: function () {
            L.DomEvent.off(this._container, "touchstart", this._onTouchStart, this),
            L.DomEvent.off(this._container, "touchend", this._onTouchEnd, this),
            L.DomEvent.off(this._container, "touchmove", this._onTouchMove, this),
            this._detectIE() ? (L.DomEvent.off(this._container, "MSPointerDown", this._onTouchStart, this), L.DomEvent.off(this._container, "MSPointerUp", this._onTouchEnd, this), L.DomEvent.off(this._container, "MSPointerMove", this._onTouchMove, this), L.DomEvent.off(this._container, "MSPointerCancel", this._onTouchCancel, this)) : (L.DomEvent.off(this._container, "touchcancel", this._onTouchCancel, this), L.DomEvent.off(this._container, "touchleave", this._onTouchLeave, this))
        },
        _touchEvent: function (t, e) {
            var i = {};
            if (void 0 !== t.touches) {
                if (! t.touches.length)
                    return;

                i = t.touches[0]
            } else {
                if ("touch" !== t.pointerType)
                    return;

                if (i = t, !this._filterClick(t))
                    return

            }
            var o = this._map.mouseEventToContainerPoint(i),
                a = this._map.mouseEventToLayerPoint(i),
                n = this._map.layerPointToLatLng(a);
            this._map.fire(e, {
                latlng: n,
                layerPoint: a,
                containerPoint: o,
                pageX: i.pageX,
                pageY: i.pageY,
                originalEvent: t
            })
        },
        _filterClick: function (t) {
            var e = t.timeStamp || t.originalEvent.timeStamp,
                i = L.DomEvent._lastClick && e - L.DomEvent._lastClick;
            return i && i > 100 && i < 500 || t.target._simulatedClick && ! t._simulated ? (L.DomEvent.stop(t), !1) : (L.DomEvent._lastClick = e, !0)
        },
        _onTouchStart: function (t) {
            if (this._map._loaded) {
                this._touchEvent(t, "touchstart")
            }
        },
        _onTouchEnd: function (t) {
            if (this._map._loaded) {
                this._touchEvent(t, "touchend")
            }
        },
        _onTouchCancel: function (t) {
            if (this._map._loaded) {
                var e = "touchcancel";
                this._detectIE() && (e = "pointercancel"),
                this._touchEvent(t, e)
            }
        },
        _onTouchLeave: function (t) {
            if (this._map._loaded) {
                this._touchEvent(t, "touchleave")
            }
        },
        _onTouchMove: function (t) {
            if (this._map._loaded) {
                this._touchEvent(t, "touchmove")
            }
        },
        _detectIE: function () {
            var e = t.navigator.userAgent,
                i = e.indexOf("MSIE ");
            if (i > 0)
                return parseInt(e.substring(i + 5, e.indexOf(".", i)), 10);

            if (e.indexOf("Trident/") > 0) {
                var o = e.indexOf("rv:");
                return parseInt(e.substring(o + 3, e.indexOf(".", o)), 10)
            }
            var a = e.indexOf("Edge/");
            return a > 0 && parseInt(e.substring(a + 5, e.indexOf(".", a)), 10)
        }
    }),
    L.Map.addInitHook("addHandler", "touchExtend", L.Map.TouchExtend),
    L.Marker.Touch = L.Marker.extend({
        _initInteraction: function () {
            return this.addInteractiveTarget ? L.Marker.prototype._initInteraction.apply(this) : this._initInteractionLegacy()
        },
        _initInteractionLegacy: function () {
            if (this.options.clickable) {
                var t = this._icon,
                    e = [
                        "dblclick",
                        "mousedown",
                        "mouseover",
                        "mouseout",
                        "contextmenu",
                        "touchstart",
                        "touchend",
                        "touchmove"
                    ];
                this._detectIE ? e.concat(["MSPointerDown", "MSPointerUp", "MSPointerMove", "MSPointerCancel"]) : e.concat(["touchcancel"]),
                L.DomUtil.addClass(t, "leaflet-clickable"),
                L.DomEvent.on(t, "click", this._onMouseClick, this),
                L.DomEvent.on(t, "keypress", this._onKeyPress, this);
                for (var i = 0; i < e.length; i++)
                    L.DomEvent.on(t, e[i], this._fireMouseEvent, this);

                L.Handler.MarkerDrag && (this.dragging = new L.Handler.MarkerDrag(this), this.options.draggable && this.dragging.enable())
            }
        },
        _detectIE: function () {
            var e = t.navigator.userAgent,
                i = e.indexOf("MSIE ");
            if (i > 0)
                return parseInt(e.substring(i + 5, e.indexOf(".", i)), 10);

            if (e.indexOf("Trident/") > 0) {
                var o = e.indexOf("rv:");
                return parseInt(e.substring(o + 3, e.indexOf(".", o)), 10)
            }
            var a = e.indexOf("Edge/");
            return a > 0 && parseInt(e.substring(a + 5, e.indexOf(".", a)), 10)
        }
    }),
    L.LatLngUtil = {
        cloneLatLngs: function (t) {
            for (var e =[], i = 0, o = t.length; i < o; i++)
                Array.isArray(t[i]) ? e.push(L.LatLngUtil.cloneLatLngs(t[i])) : e.push(this.cloneLatLng(t[i]));

            return e
        },
        cloneLatLng: function (t) {
            return L.latLng(t.lat, t.lng)
        }
    },
    function () {
        var t = {
            km: 2,
            ha: 2,
            m: 0,
            mi: 2,
            ac: 2,
            yd: 0,
            ft: 0,
            nm: 2
        };
        L.GeometryUtil = L.extend(L.GeometryUtil || {}, {
            geodesicArea: function (t) {
                var e,
                    i,
                    o = t.length,
                    a = 0,
                    n = Math.PI / 180;
                if (o > 2) {
                    for (var s = 0; s < o; s++)
                        e = t[s],
                        i = t[(s + 1) % o],
                        a += (i.lng - e.lng) * n * (2 + Math.sin(e.lat * n) + Math.sin(i.lat * n));

                    a = 6378137 * a * 6378137 / 2
                }
                return Math.abs(a)
            },
            formattedNumber: function (t, e) {
                var i = parseFloat(t).toFixed(e),
                    o = L.drawLocal.format && L.drawLocal.format.numeric,
                    a = o && o.delimiters,
                    n = a && a.thousands,
                    s = a && a.decimal;
                if (n || s) {
                    var r = i.split(".");
                    i = n ? r[0].replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1" + n) : r[0],
                    s = s || ".",
                    r.length > 1 && (i = i + s + r[1])
                }
                return i
            },
            readableArea: function (e, i, o) {
                var a,
                    n,
                    o = L.Util.extend({}, t, o);
                return i ? (n =[
                    "ha", "m"
                ], type = typeof i, "string" === type ? n =[i] : "boolean" !== type && (n = i), a = e >= 1e6 && -1 !== n.indexOf("km") ? L.GeometryUtil.formattedNumber(1e-6 * e, o.km) + " km²" : e >= 1e4 && -1 !== n.indexOf("ha") ? L.GeometryUtil.formattedNumber(1e-4 * e, o.ha) + " ha" : L.GeometryUtil.formattedNumber(e, o.m) + " m²") : (e /= .836127, a = e >= 3097600 ? L.GeometryUtil.formattedNumber(e / 3097600, o.mi) + " mi²" : e >= 4840 ? L.GeometryUtil.formattedNumber(e / 4840, o.ac) + " acres" : L.GeometryUtil.formattedNumber(e, o.yd) + " yd²"),
                a
            },
            readableDistance: function (e, i, o, a, n) {
                var s,
                    n = L.Util.extend({}, t, n);
                switch (i ? "string" == typeof i ? i : "metric" : o ? "feet" : a ? "nauticalMile" : "yards") {
                    case "metric": s = e > 1e3 ? L.GeometryUtil.formattedNumber(e / 1e3, n.km) + " km" : L.GeometryUtil.formattedNumber(e, n.m) + " m";
                        break;
                    case "feet": e *= 3.28083,
                        s = L.GeometryUtil.formattedNumber(e, n.ft) + " ft";
                        break;
                    case "nauticalMile": e *= .53996,
                        s = L.GeometryUtil.formattedNumber(e / 1e3, n.nm) + " nm";
                        break;
                    case "yards":
                    default: e *= 1.09361,
                        s = e > 1760 ? L.GeometryUtil.formattedNumber(e / 1760, n.mi) + " miles" : L.GeometryUtil.formattedNumber(e, n.yd) + " yd"
                }
                return s
            },
            isVersion07x: function () {
                var t = L.version.split(".");
                return 0 === parseInt(t[0], 10) && 7 === parseInt(t[1], 10)
            }
        })
    }(),
    L.Util.extend(L.LineUtil, {
        segmentsIntersect: function (t, e, i, o) {
            return this._checkCounterclockwise(t, i, o) !== this._checkCounterclockwise(e, i, o) && this._checkCounterclockwise(t, e, i) !== this._checkCounterclockwise(t, e, o)
        },
        _checkCounterclockwise: function (t, e, i) {
            return(i.y - t.y) * (e.x - t.x) > (e.y - t.y) * (i.x - t.x)
        }
    }),
    L.Polyline.include({
        intersects: function () {
            var t,
                e,
                i,
                o = this._getProjectedPoints(),
                a = o ? o.length : 0;
            if (this._tooFewPointsForIntersection())
                return !1;

            for (t = a - 1; t >= 3; t--)
                if (e = o[t - 1], i = o[t], this._lineSegmentsIntersectsRange(e, i, t - 2))
                    return !0;


            return !1
        },
        newLatLngIntersects: function (t, e) {
            return !!this._map && this.newPointIntersects(this._map.latLngToLayerPoint(t), e)
        },
        newPointIntersects: function (t, e) {
            var i = this._getProjectedPoints(),
                o = i ? i.length : 0,
                a = i ? i[o - 1] : null,
                n = o - 2;
            return !this._tooFewPointsForIntersection(1) && this._lineSegmentsIntersectsRange(a, t, n, e ? 1 : 0)
        },
        _tooFewPointsForIntersection: function (t) {
            var e = this._getProjectedPoints(),
                i = e ? e.length : 0;
            return i += t || 0,
            ! e || i <= 3
        },
        _lineSegmentsIntersectsRange: function (t, e, i, o) {
            var a,
                n,
                s = this._getProjectedPoints();
            o = o || 0;
            for (var r = i; r > o; r--)
                if (a = s[r - 1], n = s[r], L.LineUtil.segmentsIntersect(t, e, a, n))
                    return !0;


            return !1
        },
        _getProjectedPoints: function () {
            if (!this._defaultShape)
                return this._originalPoints;

            for (var t =[], e = this._defaultShape(), i = 0; i < e.length; i++)
                t.push(this._map.latLngToLayerPoint(e[i]));

            return t
        }
    }),
    L.Polygon.include({
        intersects: function () {
            var t,
                e,
                i,
                o,
                a = this._getProjectedPoints();
            return !this._tooFewPointsForIntersection() && (!! L.Polyline.prototype.intersects.call(this) || (t = a.length, e = a[0], i = a[t - 1], o = t - 2, this._lineSegmentsIntersectsRange(i, e, o, 1)))
        }
    }),
    L.Control.Draw = L.Control.extend({
        options: {
            position: "topleft",
            draw: {},
            edit: !1
        },
        initialize: function (t) {
            if (L.version < "0.7")
                throw new Error("Leaflet.draw 0.2.3+ requires Leaflet 0.7.0+. Download latest from https://github.com/Leaflet/Leaflet/");

            L.Control.prototype.initialize.call(this, t);
            var e;
            this._toolbars = {},
            L.DrawToolbar && this.options.draw && (e = new L.DrawToolbar(this.options.draw), this._toolbars[L.DrawToolbar.TYPE] = e, this._toolbars[L.DrawToolbar.TYPE].on("enable", this._toolbarEnabled, this)),
            L.EditToolbar && this.options.edit && (e = new L.EditToolbar(this.options.edit), this._toolbars[L.EditToolbar.TYPE] = e, this._toolbars[L.EditToolbar.TYPE].on("enable", this._toolbarEnabled, this)),
            L.toolbar = this
        },
        onAdd: function (t) {
            var e,
                i = L.DomUtil.create("div", "leaflet-draw"),
                o = !1;
            for (var a in this._toolbars)
                this._toolbars.hasOwnProperty(a) && (e = this._toolbars[a].addToolbar(t)) && (o || (L.DomUtil.hasClass(e, "leaflet-draw-toolbar-top") || L.DomUtil.addClass(e.childNodes[0], "leaflet-draw-toolbar-top"), o =! 0), i.appendChild(e));

            return i
        },
        onRemove: function () {
            for (var t in this._toolbars)
                this._toolbars.hasOwnProperty(t) && this._toolbars[t].removeToolbar()

        },
        setDrawingOptions: function (t) {
            for (var e in this._toolbars)
                this._toolbars[e] instanceof L.DrawToolbar && this._toolbars[e].setOptions(t)

        },
        _toolbarEnabled: function (t) {
            var e = t.target;
            for (var i in this._toolbars)
                this._toolbars[i] !== e && this._toolbars[i].disable()

        }
    }),
    L.Map.mergeOptions({
        drawControlTooltips: !0,
        drawControl: !1
    }),
    L.Map.addInitHook(function () {
        this.options.drawControl && (this.drawControl = new L.Control.Draw, this.addControl(this.drawControl))
    }),
    L.Toolbar = L.Class.extend({
        initialize: function (t) {
            L.setOptions(this, t),
            this._modes = {},
            this._actionButtons = [],
            this._activeMode = null;
            var e = L.version.split(".");
            1 === parseInt(e[0], 10) && parseInt(e[1], 10) >= 2 ? L.Toolbar.include(L.Evented.prototype) : L.Toolbar.include(L.Mixin.Events)
        },
        enabled: function () {
            return null !== this._activeMode
        },
        disable: function () {
            this.enabled() && this._activeMode.handler.disable()
        },
        addToolbar: function (t) {
            var e,
                i = L.DomUtil.create("div", "leaflet-draw-section"),
                o = 0,
                a = this._toolbarClass || "",
                n = this.getModeHandlers(t);
            for (this._toolbarContainer = L.DomUtil.create("div", "leaflet-draw-toolbar leaflet-bar"), this._map = t, e = 0; e < n.length; e++)
                n[e].enabled && this._initModeHandler(n[e].handler, this._toolbarContainer, o++, a, n[e].title);

            if (o)
                return this._lastButtonIndex = -- o,
                this._actionsContainer = L.DomUtil.create("ul", "leaflet-draw-actions"),
                i.appendChild(this._toolbarContainer),
                i.appendChild(this._actionsContainer),
                i

        },
        removeToolbar: function () {
            for (var t in this._modes)
                this._modes.hasOwnProperty(t) && (this._disposeButton(this._modes[t].button, this._modes[t].handler.enable, this._modes[t].handler), this._modes[t].handler.disable(), this._modes[t].handler.off("enabled", this._handlerActivated, this).off("disabled", this._handlerDeactivated, this));

            this._modes = {};
            for (var e = 0, i = this._actionButtons.length; e < i; e++)
                this._disposeButton(this._actionButtons[e].button, this._actionButtons[e].callback, this);

            this._actionButtons = [],
            this._actionsContainer = null
        },
        _initModeHandler: function (t, e, i, o, a) {
            var n = t.type;
            this._modes[n] = {},
            this._modes[n].handler = t,
            this._modes[n].button = this._createButton({
                type: n,
                title: a,
                className: o + "-" + n,
                container: e,
                callback: this._modes[n].handler.enable,
                context: this._modes[n].handler
            }),
            this._modes[n].buttonIndex = i,
            this._modes[n].handler.on("enabled", this._handlerActivated, this).on("disabled", this._handlerDeactivated, this)
        },
        _detectIOS: function () {
            return /iPad|iPhone|iPod/.test(navigator.userAgent) && ! t.MSStream
        },
        _createButton: function (t) {
            var e = L.DomUtil.create("a", t.className || "", t.container),
                i = L.DomUtil.create("span", "sr-only", t.container);
            e.href = "#",
            e.appendChild(i),
            t.title && (e.title = t.title, i.innerHTML = t.title),
            t.text && (e.innerHTML = t.text, i.innerHTML = t.text);
            var o = this._detectIOS() ? "touchstart" : "click";
            return L.DomEvent.on(e, "click", L.DomEvent.stopPropagation).on(e, "mousedown", L.DomEvent.stopPropagation).on(e, "dblclick", L.DomEvent.stopPropagation).on(e, "touchstart", L.DomEvent.stopPropagation).on(e, "click", L.DomEvent.preventDefault).on(e, o, t.callback, t.context),
            e
        },
        _disposeButton: function (t, e) {
            var i = this._detectIOS() ? "touchstart" : "click";
            L.DomEvent.off(t, "click", L.DomEvent.stopPropagation).off(t, "mousedown", L.DomEvent.stopPropagation).off(t, "dblclick", L.DomEvent.stopPropagation).off(t, "touchstart", L.DomEvent.stopPropagation).off(t, "click", L.DomEvent.preventDefault).off(t, i, e)
        },
        _handlerActivated: function (t) {
            this.disable(),
            this._activeMode = this._modes[t.handler],
            L.DomUtil.addClass(this._activeMode.button, "leaflet-draw-toolbar-button-enabled"),
            this._showActionsToolbar(),
            this.fire("enable")
        },
        _handlerDeactivated: function () {
            this._hideActionsToolbar(),
            L.DomUtil.removeClass(this._activeMode.button, "leaflet-draw-toolbar-button-enabled"),
            this._activeMode = null,
            this.fire("disable")
        },
        _createActions: function (t) {
            var e,
                i,
                o,
                a,
                n = this._actionsContainer,
                s = this.getActions(t),
                r = s.length;
            for (i = 0, o = this._actionButtons.length; i < o; i++)
                this._disposeButton(this._actionButtons[i].button, this._actionButtons[i].callback);

            for (this._actionButtons =[]; n.firstChild;)
                n.removeChild(n.firstChild);

            for (var l = 0; l < r; l++)
                "enabled" in s[l] && ! s[l].enabled || (e = L.DomUtil.create("li", "", n), a = this._createButton({
                    title: s[l].title,
                    text: s[l].text,
                    container: e,
                    callback: s[l].callback,
                    context: s[l].context
                }), this._actionButtons.push({button: a, callback: s[l].callback}))

        },
        _showActionsToolbar: function () {
            var t = this._activeMode.buttonIndex,
                e = this._lastButtonIndex,
                i = this._activeMode.button.offsetTop - 1;
            this._createActions(this._activeMode.handler),
            this._actionsContainer.style.top = i + "px",
            0 === t && (L.DomUtil.addClass(this._toolbarContainer, "leaflet-draw-toolbar-notop"), L.DomUtil.addClass(this._actionsContainer, "leaflet-draw-actions-top")),
            t === e && (L.DomUtil.addClass(this._toolbarContainer, "leaflet-draw-toolbar-nobottom"), L.DomUtil.addClass(this._actionsContainer, "leaflet-draw-actions-bottom")),
            this._actionsContainer.style.display = "block",
            this._map.fire(L.Draw.Event.TOOLBAROPENED)
        },
        _hideActionsToolbar: function () {
            this._actionsContainer.style.display = "none",
            L.DomUtil.removeClass(this._toolbarContainer, "leaflet-draw-toolbar-notop"),
            L.DomUtil.removeClass(this._toolbarContainer, "leaflet-draw-toolbar-nobottom"),
            L.DomUtil.removeClass(this._actionsContainer, "leaflet-draw-actions-top"),
            L.DomUtil.removeClass(this._actionsContainer, "leaflet-draw-actions-bottom"),
            this._map.fire(L.Draw.Event.TOOLBARCLOSED)
        }
    }),
    L.Draw = L.Draw || {},
    L.Draw.Tooltip = L.Class.extend({
        initialize: function (t) {
            this._map = t,
            this._popupPane = t._panes.popupPane,
            this._visible = !1,
            this._container = t.options.drawControlTooltips ? L.DomUtil.create("div", "leaflet-draw-tooltip", this._popupPane) : null,
            this._singleLineLabel = !1,
            this._map.on("mouseout", this._onMouseOut, this)
        },
        dispose: function () {
            this._map.off("mouseout", this._onMouseOut, this),
            this._container && (this._popupPane.removeChild(this._container), this._container = null)
        },
        updateContent: function (t) {
            return this._container ? (t.subtext = t.subtext || "", 0 !== t.subtext.length || this._singleLineLabel ? t.subtext.length > 0 && this._singleLineLabel && (L.DomUtil.removeClass(this._container, "leaflet-draw-tooltip-single"), this._singleLineLabel =! 1) : (L.DomUtil.addClass(this._container, "leaflet-draw-tooltip-single"), this._singleLineLabel =! 0), this._container.innerHTML =( t.subtext.length > 0 ? '<span class="leaflet-draw-tooltip-subtext">' + t.subtext + "</span><br />" : "") + "<span>" + t.text + "</span>", t.text || t.subtext ? (this._visible =! 0, this._container.style.visibility = "inherit") : (this._visible =! 1, this._container.style.visibility = "hidden"), this) : this
        },
        updatePosition: function (t) {
            var e = this._map.latLngToLayerPoint(t),
                i = this._container;
            return this._container && (this._visible && (i.style.visibility = "inherit"), L.DomUtil.setPosition(i, e)),
            this
        },
        showAsError: function () {
            return this._container && L.DomUtil.addClass(this._container, "leaflet-error-draw-tooltip"),
            this
        },
        removeError: function () {
            return this._container && L.DomUtil.removeClass(this._container, "leaflet-error-draw-tooltip"),
            this
        },
        _onMouseOut: function () {
            this._container && (this._container.style.visibility = "hidden")
        }
    }),
    L.DrawToolbar = L.Toolbar.extend({
        statics: {
            TYPE: "draw"
        },
        options: {
            polyline: {},
            polygon: {},
            rectangle: {},
            circle: {},
            marker: {},
            circlemarker: {}
        },
        initialize: function (t) {
            for (var e in this.options)
                this.options.hasOwnProperty(e) && t[e] && (t[e] = L.extend({}, this.options[e], t[e]));

            this._toolbarClass = "leaflet-draw-draw",
            L.Toolbar.prototype.initialize.call(this, t)
        },
        getModeHandlers: function (t) {
            return [
                {
                    enabled: this.options.polyline,
                    handler: new L.Draw.Polyline(t, this.options.polyline),
                    title: L.drawLocal.draw.toolbar.buttons.polyline
                },
                {
                    enabled: this.options.polygon,
                    handler: new L.Draw.Polygon(t, this.options.polygon),
                    title: L.drawLocal.draw.toolbar.buttons.polygon
                },
                {
                    enabled: this.options.rectangle,
                    handler: new L.Draw.Rectangle(t, this.options.rectangle),
                    title: L.drawLocal.draw.toolbar.buttons.rectangle
                },
                {
                    enabled: this.options.circle,
                    handler: new L.Draw.Circle(t, this.options.circle),
                    title: L.drawLocal.draw.toolbar.buttons.circle
                }, {
                    enabled: this.options.marker,
                    handler: new L.Draw.Marker(t, this.options.marker),
                    title: L.drawLocal.draw.toolbar.buttons.marker
                }, {
                    enabled: this.options.circlemarker,
                    handler: new L.Draw.CircleMarker(t, this.options.circlemarker),
                    title: L.drawLocal.draw.toolbar.buttons.circlemarker
                }
            ]
        },
        getActions: function (t) {
            return [
                {
                    enabled: t.completeShape,
                    title: L.drawLocal.draw.toolbar.finish.title,
                    text: L.drawLocal.draw.toolbar.finish.text,
                    callback: t.completeShape,
                    context: t
                }, {
                    enabled: t.deleteLastVertex,
                    title: L.drawLocal.draw.toolbar.undo.title,
                    text: L.drawLocal.draw.toolbar.undo.text,
                    callback: t.deleteLastVertex,
                    context: t
                }, {
                    title: L.drawLocal.draw.toolbar.actions.title,
                    text: L.drawLocal.draw.toolbar.actions.text,
                    callback: this.disable,
                    context: this
                }
            ]
        },
        setOptions: function (t) {
            L.setOptions(this, t);
            for (var e in this._modes)
                this._modes.hasOwnProperty(e) && t.hasOwnProperty(e) && this._modes[e].handler.setOptions(t[e])

        }
    }),
    L.EditToolbar = L.Toolbar.extend({
        statics: {
            TYPE: "edit"
        },
        options: {
            edit: {
                selectedPathOptions: {
                    dashArray: "10, 10",
                    fill: !0,
                    fillColor: "#fe57a1",
                    fillOpacity: .1,
                    maintainColor: !1
                }
            },
            remove: {},
            poly: null,
            featureGroup: null
        },
        initialize: function (t) {
            t.edit && (void 0 === t.edit.selectedPathOptions && (t.edit.selectedPathOptions = this.options.edit.selectedPathOptions), t.edit.selectedPathOptions = L.extend({}, this.options.edit.selectedPathOptions, t.edit.selectedPathOptions)),
            t.remove && (t.remove = L.extend({}, this.options.remove, t.remove)),
            t.poly && (t.poly = L.extend({}, this.options.poly, t.poly)),
            this._toolbarClass = "leaflet-draw-edit",
            L.Toolbar.prototype.initialize.call(this, t),
            this._selectedFeatureCount = 0
        },
        getModeHandlers: function (t) {
            var e = this.options.featureGroup;
            return [
                {
                    enabled: this.options.edit,
                    handler: new L.EditToolbar.Edit(t, {
                        featureGroup: e,
                        selectedPathOptions: this.options.edit.selectedPathOptions,
                        poly: this.options.poly
                    }),
                    title: L.drawLocal.edit.toolbar.buttons.edit
                }, {
                    enabled: this.options.remove,
                    handler: new L.EditToolbar.Delete(t, {featureGroup: e}),
                    title: L.drawLocal.edit.toolbar.buttons.remove
                }
            ]
        },
        getActions: function (t) {
            var e = [
                {
                    title: L.drawLocal.edit.toolbar.actions.save.title,
                    text: L.drawLocal.edit.toolbar.actions.save.text,
                    callback: this._save,
                    context: this
                }, {
                    title: L.drawLocal.edit.toolbar.actions.cancel.title,
                    text: L.drawLocal.edit.toolbar.actions.cancel.text,
                    callback: this.disable,
                    context: this
                }
            ];
            return t.removeAllLayers && e.push({title: L.drawLocal.edit.toolbar.actions.clearAll.title, text: L.drawLocal.edit.toolbar.actions.clearAll.text, callback: this._clearAllLayers, context: this}),
            e
        },
        addToolbar: function (t) {
            var e = L.Toolbar.prototype.addToolbar.call(this, t);
            return this._checkDisabled(),
            this.options.featureGroup.on("layeradd layerremove", this._checkDisabled, this),
            e
        },
        removeToolbar: function () {
            this.options.featureGroup.off("layeradd layerremove", this._checkDisabled, this),
            L.Toolbar.prototype.removeToolbar.call(this)
        },
        disable: function () {
            this.enabled() && (this._activeMode.handler.revertLayers(), L.Toolbar.prototype.disable.call(this))
        },
        _save: function () {
            this._activeMode.handler.save(),
            this._activeMode && this._activeMode.handler.disable()
        },
        _clearAllLayers: function () {
            this._activeMode.handler.removeAllLayers(),
            this._activeMode && this._activeMode.handler.disable()
        },
        _checkDisabled: function () {
            var t,
                e = this.options.featureGroup,
                i = 0 !== e.getLayers().length;
            // this.options.edit && (t = this._modes[L.EditToolbar.Edit.TYPE].button, i ? L.DomUtil.removeClass(t, "leaflet-disabled") : L.DomUtil.addClass(t, "leaflet-disabled"), t.setAttribute("title", i ? L.drawLocal.edit.toolbar.buttons.edit : L.drawLocal.edit.toolbar.buttons.editDisabled)),
            // this.options.remove && (t = this._modes[L.EditToolbar.Delete.TYPE].button, i ? L.DomUtil.removeClass(t, "leaflet-disabled") : L.DomUtil.addClass(t, "leaflet-disabled"), t.setAttribute("title", i ? L.drawLocal.edit.toolbar.buttons.remove : L.drawLocal.edit.toolbar.buttons.removeDisabled))
        }
    }),
    L.EditToolbar.Edit = L.Handler.extend({
        statics: {
            TYPE: "edit"
        },
        initialize: function (t, e) {
            if (L.Handler.prototype.initialize.call(this, t), L.setOptions(this, e), this._featureGroup = e.featureGroup, !(this._featureGroup instanceof L.FeatureGroup))
                throw new Error("options.featureGroup must be a L.FeatureGroup");

            this._uneditedLayerProps = {},
            this.type = L.EditToolbar.Edit.TYPE;
            var i = L.version.split(".");
            1 === parseInt(i[0], 10) && parseInt(i[1], 10) >= 2 ? L.EditToolbar.Edit.include(L.Evented.prototype) : L.EditToolbar.Edit.include(L.Mixin.Events)
        },
        enable: function () {
            !this._enabled && this._hasAvailableLayers() && (this.fire("enabled", {handler: this.type}), this._map.fire(L.Draw.Event.EDITSTART, {handler: this.type}), L.Handler.prototype.enable.call(this), this._featureGroup.on("layeradd", this._enableLayerEdit, this).on("layerremove", this._disableLayerEdit, this))
        },
        disable: function () {
            this._enabled && (this._featureGroup.off("layeradd", this._enableLayerEdit, this).off("layerremove", this._disableLayerEdit, this), L.Handler.prototype.disable.call(this), this._map.fire(L.Draw.Event.EDITSTOP, {handler: this.type}), this.fire("disabled", {handler: this.type}))
        },
        addHooks: function () {
            var t = this._map;
            t && (t.getContainer().focus(), this._featureGroup.eachLayer(this._enableLayerEdit, this), this._tooltip = new L.Draw.Tooltip(this._map), this._tooltip.updateContent({text: L.drawLocal.edit.handlers.edit.tooltip.text, subtext: L.drawLocal.edit.handlers.edit.tooltip.subtext}), t._editTooltip = this._tooltip, this._updateTooltip(), this._map.on("mousemove", this._onMouseMove, this).on("touchmove", this._onMouseMove, this).on("MSPointerMove", this._onMouseMove, this).on(L.Draw.Event.EDITVERTEX, this._updateTooltip, this))
        },
        removeHooks: function () {
            this._map && (this._featureGroup.eachLayer(this._disableLayerEdit, this), this._uneditedLayerProps =
                {}, this._tooltip.dispose(), this._tooltip = null, this._map.off("mousemove", this._onMouseMove, this).off("touchmove", this._onMouseMove, this).off("MSPointerMove", this._onMouseMove, this).off(L.Draw.Event.EDITVERTEX, this._updateTooltip, this))
        },
        revertLayers: function () {
            this._featureGroup.eachLayer(function (t) {
                this._revertLayer(t)
            }, this)
        },
        save: function () {
            var t = new L.LayerGroup;
            this._featureGroup.eachLayer(function (e) {
                e.edited && (t.addLayer(e), e.edited =! 1)
            }),
            this._map.fire(L.Draw.Event.EDITED, {layers: t})
        },
        _backupLayer: function (t) {
            var e = L.Util.stamp(t);
            this._uneditedLayerProps[e] || (t instanceof L.Polyline || t instanceof L.Polygon || t instanceof L.Rectangle ? this._uneditedLayerProps[e] =
                { latlngs: L.LatLngUtil.cloneLatLngs(t.getLatLngs())
            } : t instanceof L.Circle ? this._uneditedLayerProps[e] =
                { latlng: L.LatLngUtil.cloneLatLng(t.getLatLng()),
                radius: t.getRadius()
            } : (t instanceof L.Marker || t instanceof L.CircleMarker) && (this._uneditedLayerProps[e] =
                { latlng: L.LatLngUtil.cloneLatLng(t.getLatLng())
            }))
        },
        _getTooltipText: function () {
            return {text: L.drawLocal.edit.handlers.edit.tooltip.text, subtext: L.drawLocal.edit.handlers.edit.tooltip.subtext}
        },
        _updateTooltip: function () {
            this._tooltip.updateContent(this._getTooltipText())
        },
        _revertLayer: function (t) {
            var e = L.Util.stamp(t);
            t.edited = !1,
            this._uneditedLayerProps.hasOwnProperty(e) && (t instanceof L.Polyline || t instanceof L.Polygon || t instanceof L.Rectangle ? t.setLatLngs(this._uneditedLayerProps[e].latlngs) : t instanceof L.Circle ? (t.setLatLng(this._uneditedLayerProps[e].latlng), t.setRadius(this._uneditedLayerProps[e].radius)) : (t instanceof L.Marker || t instanceof L.CircleMarker) && t.setLatLng(this._uneditedLayerProps[e].latlng), t.fire("revert-edited", {layer: t}))
        },
        _enableLayerEdit: function (t) {
            var e,
                i,
                o = t.layer || t.target || t;
            this._backupLayer(o),
            this.options.poly && (i = L.Util.extend({}, this.options.poly), o.options.poly = i),
            this.options.selectedPathOptions && (e = L.Util.extend({}, this.options.selectedPathOptions), e.maintainColor && (e.color = o.options.color, e.fillColor = o.options.fillColor), o.options.original = L.extend({}, o.options), o.options.editing = e),
            o instanceof L.Marker ? (o.editing && o.editing.enable(), o.dragging.enable(), o.on("dragend", this._onMarkerDragEnd).on("touchmove", this._onTouchMove, this).on("MSPointerMove", this._onTouchMove, this).on("touchend", this._onMarkerDragEnd, this).on("MSPointerUp", this._onMarkerDragEnd, this)) : o.editing.enable()
        },
        _disableLayerEdit: function (t) {
            var e = t.layer || t.target || t;
            e.edited = !1,
            e.editing && e.editing.disable(),
            delete e.options.editing,
            delete e.options.original,
            this._selectedPathOptions && (e instanceof L.Marker ? this._toggleMarkerHighlight(e) : (e.setStyle(e.options.previousOptions), delete e.options.previousOptions)),
            e instanceof L.Marker ? (e.dragging.disable(), e.off("dragend", this._onMarkerDragEnd, this).off("touchmove", this._onTouchMove, this).off("MSPointerMove", this._onTouchMove, this).off("touchend", this._onMarkerDragEnd, this).off("MSPointerUp", this._onMarkerDragEnd, this)) : e.editing.disable()
        },
        _onMouseMove: function (t) {
            this._tooltip.updatePosition(t.latlng)
        },
        _onMarkerDragEnd: function (t) {
            var e = t.target;
            e.edited = !0,
            this._map.fire(L.Draw.Event.EDITMOVE, {layer: e})
        },
        _onTouchMove: function (t) {
            var e = t.originalEvent.changedTouches[0],
                i = this._map.mouseEventToLayerPoint(e),
                o = this._map.layerPointToLatLng(i);
            t.target.setLatLng(o)
        },
        _hasAvailableLayers: function () {
            return 0 !== this._featureGroup.getLayers().length
        }
    }),
    L.EditToolbar.Delete = L.Handler.extend({
        statics: {
            TYPE: "remove"
        },
        initialize: function (t, e) {
            if (L.Handler.prototype.initialize.call(this, t), L.Util.setOptions(this, e), this._deletableLayers = this.options.featureGroup, !(this._deletableLayers instanceof L.FeatureGroup))
                throw new Error("options.featureGroup must be a L.FeatureGroup");

            this.type = L.EditToolbar.Delete.TYPE;
            var i = L.version.split(".");
            1 === parseInt(i[0], 10) && parseInt(i[1], 10) >= 2 ? L.EditToolbar.Delete.include(L.Evented.prototype) : L.EditToolbar.Delete.include(L.Mixin.Events)
        },
        enable: function () {
            !this._enabled && this._hasAvailableLayers() && (this.fire("enabled", {handler: this.type}), this._map.fire(L.Draw.Event.DELETESTART, {handler: this.type}), L.Handler.prototype.enable.call(this), this._deletableLayers.on("layeradd", this._enableLayerDelete, this).on("layerremove", this._disableLayerDelete, this))
        },
        disable: function () {
            this._enabled && (this._deletableLayers.off("layeradd", this._enableLayerDelete, this).off("layerremove", this._disableLayerDelete, this), L.Handler.prototype.disable.call(this), this._map.fire(L.Draw.Event.DELETESTOP, {handler: this.type}), this.fire("disabled", {handler: this.type}))
        },
        addHooks: function () {
            var t = this._map;
            t && (t.getContainer().focus(), this._deletableLayers.eachLayer(this._enableLayerDelete, this), this._deletedLayers = new L.LayerGroup, this._tooltip = new L.Draw.Tooltip(this._map), this._tooltip.updateContent({text: L.drawLocal.edit.handlers.remove.tooltip.text}), this._map.on("mousemove", this._onMouseMove, this))
        },
        removeHooks: function () {
            this._map && (this._deletableLayers.eachLayer(this._disableLayerDelete, this), this._deletedLayers = null, this._tooltip.dispose(), this._tooltip = null, this._map.off("mousemove", this._onMouseMove, this))
        },
        revertLayers: function () {
            this._deletedLayers.eachLayer(function (t) {
                this._deletableLayers.addLayer(t),
                t.fire("revert-deleted", {layer: t})
            }, this)
        },
        save: function () {
            this._map.fire(L.Draw.Event.DELETED, {layers: this._deletedLayers})
        },
        removeAllLayers: function () {
            this._deletableLayers.eachLayer(function (t) {
                this._removeLayer({layer: t})
            }, this),
            this.save()
        },
        _enableLayerDelete: function (t) {
            (t.layer || t.target || t).on("click", this._removeLayer, this)
        },
        _disableLayerDelete: function (t) {
            var e = t.layer || t.target || t;
            e.off("click", this._removeLayer, this),
            this._deletedLayers.removeLayer(e)
        },
        _removeLayer: function (t) {
            var e = t.layer || t.target || t;
            this._deletableLayers.removeLayer(e),
            this._deletedLayers.addLayer(e),
            e.fire("deleted")
        },
        _onMouseMove: function (t) {
            this._tooltip.updatePosition(t.latlng)
        },
        _hasAvailableLayers: function () {
            return 0 !== this._deletableLayers.getLayers().length
        }
    })
}(window, document);
