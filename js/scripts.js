const mapboxURL =
  "https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}"
const year = new Date().getFullYear()
const gidArray = []
const geoidArray = []
const selectedLayerGroup = L.featureGroup({ pane: "pointsPane" })

// INITIALIZING LAYERS
// BASE LAYERS
const mbLight = L.tileLayer(mapboxURL, {
  id: "mapbox/light-v10",
  tileSize: 512,
  maxZoom: 18,
  zoomOffset: -1,
  accessToken: accessToken
})

const mbStreets = L.tileLayer(mapboxURL, {
  id: "mapbox/streets-v11",
  tileSize: 512,
  maxZoom: 18,
  zoomOffset: -1,
  accessToken: accessToken
})

// OVERLAY LAYERS
// Sewershed Choropleths
const ntaCSA = L.geoJSON(null, {
  style: myStyle.csaChoro,
  onEachFeature: onEachNTAFeature,
  filter: feature => {
    return !["park-cemetery-etc", "Airport"].some(str =>
      feature.properties.neighborhood.includes(str)
    )
  },
  pane: "polygonsPane"
})

const ntaImpervious = L.geoJSON(null, {
  style: myStyle.impervChoro,
  onEachFeature: onEachNTAFeature,
  filter: feature => {
    return !["park-cemetery-etc", "Airport"].some(str =>
      feature.properties.neighborhood.includes(str)
    )
  },
  pane: "polygonsPane"
})

const ntaLayerGroup = L.featureGroup([ntaCSA, ntaImpervious])

// Wastewater Treatment Plants
const plants = L.geoJSON(null, {
  pointToLayer: (feature, latlng) => {
    return L.marker(latlng, { icon: tpIcon })
  },
  onEachFeature: onEachTP,
  filter: feature => {
    return feature.properties.wpcp !== null
  }
})

// CSO Outfalls
const outfalls = L.geoJSON(null, {
  pointToLayer: (feature, latlng) => {
    return L.circleMarker(latlng, myStyle.outfalls)
  },
  interactive: false
  // onEachFeature: onEachOutfall,
})

// Sewer Interceptors
const interceptors = L.geoJSON(null, {
  style: myStyle.interceptors,
  pane: "linesPane",
  interactive: false
})

// Sewersheds
const sewersheds = L.geoJSON(null, {
  style: myStyle.sewersheds,
  onEachFeature: onEachSewershed,
  filter: feature => {
    return !["NA", "UNKNOWN"].some(str =>
      feature.properties.sewershed.includes(str)
    )
  },
  pane: "polygonsPane"
})

// Different Sewer Type Areas
const sewerAreas = L.geoJSON(null, {
  style: myStyle.sewerAreas,
  onEachFeature: onEachSewerArea,
  pane: "polygonsPane"
})

// Green infrastructures marker layers by construction status
const giConstructed = L.geoJSON(null)
const giInConstruction = L.geoJSON(null)
const giPlanning = L.geoJSON(null)

// Convert green infrastructure layers to marker clusters
const giClustersCon = L.markerClusterGroup({
  maxClusterRadius: 50,
  singleMarkerMode: true
})
const giClustersInCon = L.markerClusterGroup({
  maxClusterRadius: 50,
  singleMarkerMode: true
})
const giClustersPlan = L.markerClusterGroup({
  maxClusterRadius: 50,
  singleMarkerMode: true
})
const giClusters = L.markerClusterGroup({
  maxClusterRadius: 50,
  singleMarkerMode: true
})

// 311 call layers related to sewer issues
const callsFlooding = L.geoJSON(null)
const callsOdor = L.geoJSON(null)

// Convert 311 calls layers to marker clusters
const callsClustersFlood = L.markerClusterGroup({
  maxClusterRadius: 50,
  singleMarkerMode: true
})
const callsClustersOdor = L.markerClusterGroup({
  maxClusterRadius: 50,
  singleMarkerMode: true
})

const drawnItems = new L.FeatureGroup()

// Create Leaflet map
const myMap = L.map("mapid", {
  center: [40.71, -73.93],
  zoom: 11,
  layers: [mbLight, ntaCSA, plants, interceptors, drawnItems],
  zoomControl: false,
  maxBounds: L.latLngBounds(L.latLng(40.43, -74.7), L.latLng(40.98, -73.1)),
  minZoom: 10,
  fullscreenControl: { pseudoFullscreen: true },
  attributionControl: false,
  tap: false // remove touch screen problems
})

// Get bounds for default view
const defaultBounds = myMap.getBounds()

// Add CSA percentage legend
const legend = L.control({ position: "bottomleft" })
legend.onAdd = map => {
  let grades, colorFunc, title
  const div = L.DomUtil.create("div", "info legend unselectable")

  if (map.hasLayer(ntaCSA)) {
    grades = [0, 0.072, 0.273, 0.554, 0.739, 0.861, 0.948]
    colorFunc = myStyle.getChoroColorCSA
    title =
      '<h6 class="font-weight-bold">Combined Sewer <br> Areas Percentage</h6>'
  } else {
    grades = [0, 0.368, 0.487, 0.581, 0.67, 0.756, 0.829]
    colorFunc = myStyle.getChoroColorImperv
    title =
      '<h6 class="font-weight-bold">Impervious Surfaces <br> Percentage</h6>'
  }

  let html = [title]
  let labels = []
  for (let i = 0; i < grades.length; i++) {
    labels.push(
      `<i style="background: ${colorFunc(grades[i] + 0.01)}"></i>${(
        grades[i] * 100
      ).toFixed(1)}%` +
        (grades[i + 1]
          ? "&ndash;" + ((grades[i + 1] - 0.001) * 100).toFixed(1) + "%"
          : "&ndash;100%")
    )
  }
  html.push(labels.join("<br>"))
  div.innerHTML = html.join("")
  return div
}
legend.addTo(myMap)

// Create map panes for each geometry type
myMap.createPane("polygonsPane")
myMap.createPane("linesPane")
myMap.createPane("pointsPane")

// Grouped overlays and options
const groupedOverlays = {
  Neighborhoods: {
    "CSA Percentage": ntaCSA,
    "Impervious Percentage": ntaImpervious
  },
  "Green Infrastructures": {
    Constructed: giClustersCon,
    "In Construction": giClustersInCon,
    Designed: giClustersPlan
  },
  "311 Sewer Calls": {
    "Clogged/Flooding": callsClustersFlood,
    "Sewer Odor": callsClustersOdor
  },
  "Other Layers": {
    "WW Treatment Plants": plants,
    "CSO Outfalls": outfalls,
    "Sewer Interceptors": interceptors,
    "Sewer Area Types": sewerAreas,
    Sewersheds: sewersheds
  }
}
const overlayOptions = {
  exclusiveGroups: ["Neighborhoods"]
}

const baseMaps = {
  Grayscale: mbLight,
  Streets: mbStreets
}

const layerControls = L.control
  .groupedLayers(baseMaps, groupedOverlays, overlayOptions)
  .addTo(myMap)

// Get NTA geoJSON data
$.getJSON(
  "https://raw.githubusercontent.com/allan-lu/js/main/data/nyc-sewers-wgs84.geojson",
  data => {
    // Add data to GeoJSON layer
    ntaCSA.addData(data)
    ntaImpervious.addData(data)

    // Create left side neighborhod panel
    data.features
      // Filter out airports and parks
      .filter(e => {
        const neighborhoods = e.properties.neighborhood.split(/-(?![a-z])|,\s*/)

        return !["cemetery-etc-park", "park-cemetery-etc", "Airport"].some(
          str => neighborhoods.includes(str)
        )
          ? true
          : false
      })
      // Split NTA names into individual neighborhoods
      .map(e => {
        const properties = e.properties
        const neighborhoods = properties.neighborhood.split(/-(?![a-z])|,\s*/)
        const bounds = L.geoJSON(e).getBounds()

        return neighborhoods.map(el => {
          const obj = {}
          obj[el] = properties
          obj[el].bounds = bounds
          return obj
        })
      })
      .flat()
      // Alphabetize
      .sort((a, b) => (Object.keys(a)[0] < Object.keys(b)[0] ? -1 : 1))
      // Create clickable neighborhood elements
      .forEach(e => {
        const neighborhood = Object.keys(e)[0]
        const properties = Object.values(e)[0]
        const bounds = properties.bounds
        $("#nbhd-list").append(
          $("<li>")
            .addClass([
              "col",
              "list-group-item",
              "list-group-item-action",
              "p-1",
              "unselectable"
            ])
            .text(neighborhood)
            .attr({ gid: properties.gid, title: "Select a neighborhood" })
            .data({
              properties: properties,
              bounds: bounds
            })
        )
      })

    // Add events to the list items in the leftside panel
    $("#nbhd-list")
      .children(".list-group-item")
      .on({
        // Change cursor to pointer when hovering over list items
        mouseenter: e => {
          $(e.target).css("cursor", "pointer")
        },
        // Display neighborhood attributes on rightside panel when element is clicked
        click: e => {
          const feature = $(e.target).data()
          const gid = feature.properties.gid
          const bounds = feature.bounds
          const padding = [90, 40]

          selectAndZoom(feature.properties, gid, bounds, padding, false)
        }
      })
  }
)

// Get treatment plants geoJSON data
$.getJSON(
  "https://raw.githubusercontent.com/allan-lu/js/main/data/nyc-treatmentplant-wgs84.geojson",
  data => {
    plants.addData(data)
  }
)

// Get comnbined sewer outfalls geoJSON data
$.getJSON(
  "https://raw.githubusercontent.com/allan-lu/js/main/data/nyc-outfalls-wgs84.geojson",
  data => {
    outfalls.addData(data)
  }
)

// Get sewer interceptors geoJSON data
$.getJSON(
  "https://raw.githubusercontent.com/allan-lu/js/main/data/nyc-sewerinterceptors-wgs84.geojson",
  data => {
    interceptors.addData(data)
  }
)

// Get sewershed geoJSON data
$.getJSON(
  "https://raw.githubusercontent.com/allan-lu/js/main/data/nyc-sewersheds-wgs84.geojson",
  data => {
    sewersheds.addData(data)
  }
)

// Get sewer area type geoJSON data
$.getJSON(
  "https://raw.githubusercontent.com/allan-lu/js/main/data/nyc-sewerareas-wgs84.geojson",
  data => {
    sewerAreas.addData(data)
  }
)

// Get green infrastructure geoJSON data
// Constructed
$.getJSON(
  "https://data.cityofnewyork.us/resource/uyfj-5xid.geojson?$where=status_gro = 'Constructed' AND the_geom is not null&$limit=25000",
  data => {
    giConstructed.addData(data)
    giClustersCon.addLayer(giConstructed)
  }
)
// In Construction
$.getJSON(
  "https://data.cityofnewyork.us/resource/uyfj-5xid.geojson?$where=status_gro = 'In Construction' AND the_geom is not null&$limit=25000",
  data => {
    giInConstruction.addData(data)
    giClustersInCon.addLayer(giInConstruction)
  }
)
// Designed
$.getJSON(
  "https://data.cityofnewyork.us/resource/uyfj-5xid.geojson?$where=status_gro = 'Final Design' AND the_geom is not null&$limit=25000",
  data => {
    giPlanning.addData(data)
    giClustersPlan.addLayer(giPlanning)
  }
)

// Get 311 calls geoJSON data
// Clogged/Flooding
$.getJSON(
  `https://data.cityofnewyork.us/resource/erm2-nwe9.geojson?$where=date_extract_y(created_date)=${
    year - 1
  } AND complaint_type in ('Indoor Sewage', 'Industrial Waste', 'Sewer') AND (descriptor like '%25IDG)' OR descriptor like '%25SC)' OR descriptor like '%25SA1)' OR descriptor like '%25SA)' OR descriptor like '%25SJ)') AND location is not null&$limit=25000`,
  data => {
    callsFlooding.addData(data)
    callsClustersFlood.addLayer(callsFlooding)
  }
)
// Sewer Odor
$.getJSON(
  `https://data.cityofnewyork.us/resource/erm2-nwe9.geojson?$where=date_extract_y(created_date)=${
    year - 1
  } AND complaint_type in ('Indoor Sewage', 'Industrial Waste', 'Sewer') AND (descriptor like '%25SA2)' OR descriptor like '%25ICB)') AND location is not null&$limit=5000`,
  data => {
    callsOdor.addData(data)
    callsClustersOdor.addLayer(callsOdor)
  }
)

// Add home zoom control
const zoomHome = L.Control.zoomHome()
zoomHome.addTo(myMap)

// Add search feature control to Leaflet map
const searchControl = new L.Control.Search({
  layer: ntaCSA,
  propertyName: "neighborhood",
  marker: false,
  initial: false,
  autoCollapse: true,
  textPlaceholder: "Search Neighborhood"
})
myMap.addControl(searchControl)

// When a feature is found, select the feature
searchControl.on({
  "search:locationfound": e => {
    const target = e.layer
    const properties = target.feature.properties
    const gid = properties.gid
    const bounds = target.getBounds()

    if (gidArray.includes(gid)) {
      zoomToBounds(bounds, [90, 40])
    } else {
      selectAndZoom(properties, gid, bounds, [90, 40])
    }
  }
  // "search:collapsed": () => {
  //   const scale = "scale(1)"
  //   document.body.style.msTransform = scale // IE 9
  //   document.body.style.transform = scale // General
  // }
})

// Fix Leaflet Search Plugin
// Make button part of the leaflet-bar class
$("div.leaflet-control-search.leaflet-control").addClass("leaflet-bar")
$(".leaflet-control-search .search-button")
  .css("cssText", "background: none !important;")
  .attr("role", "button")
  .addClass("leaflet-bar-part")
// Replace search png with FA icon
$(".leaflet-control-search .search-button").append(
  $("<i>").addClass(["fas", "fa-search", "fa-lg"]).css({ color: "black" })
)
$(".leaflet-control-search .search-alert")
  .remove()
  .insertBefore($(".leaflet-control-search .search-button"))
//Replace cancel png with FA icon
$(".leaflet-control-search .search-cancel").css(
  "cssText",
  "background: none !important; border-bottom: none; margin: 0px;"
)
$(".leaflet-control-search .search-cancel").append(
  $("<i>").addClass(["far", "fa-times-circle", "fa-md"]).css({ color: "gray" })
)

// Leaflet sidebar
const sidebar = L.control
  .sidebar({
    autopan: true,
    closeButton: true,
    container: "sidebar",
    position: "right"
  })
  .addTo(myMap)

// Hide sidebar and push right side controls over
$("#sidebar").addClass("d-lg-none")
$(".leaflet-control-container .leaflet-right").addClass("on-right")

// Rectangular area selector
const drawOptions = {
  position: "topright",
  draw: {
    polyline: false,
    polygon: {
      allowIntersection: false,
      drawError: {
        color: "gray",
        message: "Error! Shape edges cannot cross!"
      },
      shapeOptions: { color: "red" }
    },
    rectangle: {
      shapeOptions: { color: "red" }
    },
    circle: {
      shapeOptions: { color: "red" },
      showRadius: true
    },
    marker: false,
    circlemarker: false
  },
  edit: {
    featureGroup: drawnItems
  }
}

// Set the button title text for the leaflet.draw toolbar buttons
L.drawLocal.draw.toolbar.buttons.polygon = "Polygon select"
L.drawLocal.draw.toolbar.buttons.rectangle = "Rectangle select"
L.drawLocal.draw.toolbar.buttons.circle = "Circle select"
L.drawLocal.edit.toolbar.buttons.edit = "Edit selector polygon"
L.drawLocal.edit.toolbar.buttons.editDisabled = "No selector polygon to edit"
L.drawLocal.edit.toolbar.buttons.remove = "Clear selection"
L.drawLocal.edit.toolbar.buttons.removeDisabled = "No polygons selectedd"

// Remove options from delete drawn layers button
L.EditToolbar.Delete.include({
  enable: () => {
    clearNTAs()
    zoomToBounds(defaultBounds)
  }
})

// Add selector tools to to map
const drawControl = new L.Control.Draw(drawOptions).addTo(myMap)

// Map events
myMap.on({
  // When a map layer is added:
  overlayadd: layer => {
    // Add corresponding legend
    myMap.addControl(legend)
  },
  // Show sidebar when map is fullscreen
  fullscreenchange: () => {
    if (myMap.isFullscreen()) {
      // Show sidebar
      $("#sidebar").removeClass("d-lg-none")
      // Move controls over
      $(".leaflet-control-container .leaflet-right").removeClass("on-right")
    } else {
      sidebar.close()
      $("#sidebar").addClass("d-lg-none")
      $(".leaflet-control-container .leaflet-right").addClass("on-right")
    }
  },
  // While drawing the selector polygon, prevent map layer events
  "draw:toolbaropened": () => {
    ntaCSA.eachLayer(layer => {
      layer.off()
    })
  },
  // Re-enable map layer events when stopped/finished drawing
  "draw:toolbarclosed": () => {
    ntaCSA.eachLayer(layer => {
      onEachNTAFeature(null, layer)
    })
  },
  // When a selector polygon is drawn:
  "draw:created": e => {
    const layer = e.layer
    // Find which polygons were selected, and populate & style elements accordingly
    selectMultiple(layer)
  },
  // When the selector polygon is edited, update the selected polygons & sidebar panes
  "draw:edited": e => {
    const layer = e.layers.getLayers()[0]
    // If selector polygon was unchanged, perform no changes
    if (layer === undefined) return

    selectMultiple(layer)
  }
})

$(document).ready(() => {
  // When selecting a tab in the sidebar activate the same tab in the right panel
  $(".leaflet-sidebar-tabs li a").click(e => {
    const href =
      $(e.target).attr("href") !== undefined
        ? $(e.target).attr("href").split("-")[0].concat("-p")
        : $(e.target).parent().attr("href").split("-")[0].concat("-p")
    $(".nav-tabs a").removeClass("active")
    $(".tab-content div").removeClass(["show", "active"])
    $(`.nav-tabs a[href="${href}"]`).addClass("active")
    $(href).addClass(["show", "active"])
  })
})
