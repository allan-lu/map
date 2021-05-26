const mapboxURL =
  "https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}"
const mapboxAttribution =
  'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>'
const mediaQuery = window.matchMedia("(min-width: 768px)")
const gidArray = []
const geoidArray = []
const selectedLayerGroup = L.featureGroup({ pane: "pointsPane" })

// INITIALIZING LAYERS //
// BASE LAYERS //
const mbLight = L.tileLayer(mapboxURL, {
  id: "mapbox/light-v10",
  tileSize: 512,
  maxZoom: 18,
  zoomOffset: -1,
  attribution: mapboxAttribution,
  accessToken: accessToken
})

const mbStreets = L.tileLayer(mapboxURL, {
  id: "mapbox/streets-v11",
  tileSize: 512,
  maxZoom: 18,
  zoomOffset: -1,
  attribution: mapboxAttribution,
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
  }
  // onEachFeature: onEachOutfall,
})

// Sewer Interceptors
const interceptors = L.geoJSON(null, {
  style: myStyle.interceptors,
  pane: "linesPane"
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
const giConstructed = L.geoJSON(null, {
  filter: feature => {
    return ["Constructed"].some(str => feature.properties.status.includes(str))
  }
})
const giInConstruction = L.geoJSON(null, {
  filter: feature => {
    return ["Construction"].some(str => feature.properties.status.includes(str))
  }
})
const giPlanning = L.geoJSON(null, {
  filter: feature => {
    return ["Design"].some(str => feature.properties.status.includes(str))
  }
})

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
const callsFlooding = L.geoJSON(null, {
  filter: feature => {
    return ["SC", "IDG", "SA1", "SA", "SJ"].some(str =>
      feature.properties.complaint.includes(str)
    )
  }
})
const callsOdor = L.geoJSON(null, {
  filter: feature => {
    return ["SA2", "ICB"].some(str =>
      feature.properties.complaint.includes(str)
    )
  }
})

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
  tap: false // remove touch screen problems?
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
      '<h6 class="font-weight-bold">Percent of Combined <br> Sewer Areas</h6>'
  } else {
    grades = [0, 0.368, 0.487, 0.581, 0.67, 0.756, 0.829]
    colorFunc = myStyle.getChoroColorImperv
    title = '<h6 class="font-weight-bold">Percent of <br> Impervious Land</h6>'
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
    "Impervious Percent": ntaImpervious
  },
  "Green Infrastructures": {
    Constructed: giClustersCon,
    "In Construction": giClustersInCon,
    "In Planning": giClustersPlan
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

    // Sort the polygons by the neighborhood name in ascending order
    data.features.sort((a, b) => {
      // Also sort the neighborhood names within each NTA
      const i = a.properties.neighborhood.split("-").sort().join("-")
      const j = b.properties.neighborhood.split("-").sort().join("-")
      return i < j ? -1 : 1
    })

    for (const i in data.features) {
      const nta = data.features[i]
      const neighborhood = nta.properties.neighborhood.split("-").sort().join("-")

      if (
        !["park-cemetery-etc", "Airport"].some(str =>
          neighborhood.includes(str)
        )
      ) {
        // Add neighborhood names to left side panel
        $("#nbhd-list").append(
          $("<a>")
            .addClass([
              "col",
              "list-group-item",
              "list-group-item-action",
              "p-1",
              "unselectable"
            ])
            .text(neighborhood)
            .attr({ id: nta.properties.gid, title: "Select a neighborhood" })
            .data({
              properties: nta.properties,
              bounds: L.geoJSON(nta).getBounds()
            })
        )
      }
    }

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
          const gid = parseInt($(e.target).attr("id"))
          const bounds = feature.bounds
          const padding = [90, 90]

          selectAndZoom(feature.properties, gid, bounds, padding)
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
$.getJSON(
  "https://raw.githubusercontent.com/allan-lu/js/main/data/nyc-greeninfras-wgs84.geojson",
  data => {
    giConstructed.addData(data)
    giInConstruction.addData(data)
    giPlanning.addData(data)

    giClustersCon.addLayer(giConstructed)
    giClustersInCon.addLayer(giInConstruction)
    giClustersPlan.addLayer(giPlanning)
  }
)

// Get 311 calls geoJSON data
$.getJSON(
  "https://raw.githubusercontent.com/allan-lu/js/main/data/nyc-311calls-wgs84.geojson",
  data => {
    callsFlooding.addData(data)
    callsOdor.addData(data)

    callsClustersFlood.addLayer(callsFlooding)
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
  textPlaceholder: "Search Neighborhood"
})
myMap.addControl(searchControl)

// When a feature is found, select the feature
searchControl.on({
  "search:locationfound": e => {
    const target = e.layer
    const gid = target.feature.properties.gid

    selectNTA(gid)
    displayAttributes(target.feature.properties)
  }
})

// Leaflet sidebar
const sidebar = L.control
  .sidebar({
    autopan: true,
    closeButton: true,
    container: "sidebar",
    position: "right"
  })
  .addTo(myMap)

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
