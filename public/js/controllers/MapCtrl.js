// angular.module('vacantlotsApp').config(function(uiGmapGoogleMapApiProvider)
// {
//     console.log('In config');
//     uiGmapGoogleMapApiProvider.configure(
//     {
//         //TODO: Factor this into another js file that isn't tracked with git?
//         key: "AIzaSyA5sCewJikG42pgRQOIJ_NjnVv3c6O_d6I",
//         v: '3.20', //defaults to latest 3.X anyhow
//         libraries: 'weather,geometry,visualization'
//     });
// });


//this needs to be changed, perhaps in a separate files with a more descriptive name

/**
 * Creates google map and streetview populated with location markers. Handles clicks on the markers, which
 * cause a request to find the nearest streetview location. The streetview point of view is then set to the
 * marker position.
 */
angular.module('vacantlotsApp').controller('MapCtrl', ['$state', '$http', 'sharedpropertiesService', function($state, $http, sharedpropertiesService)
{
  var vm = this;
  vm.sharedpropertiesService = sharedpropertiesService

  var center = new google.maps.LatLng(40.7356357, -74.18 );
  vm.map = new google.maps.Map(document.getElementById('map'), {
        zoom: 13,
        center: center,
        mapTypeId: google.maps.MapTypeId.ROADMAP
      });


  vm.markers= [];
  vm.locations = [];

  vm.panorama = new google.maps.StreetViewPanorama(document.getElementById('streetview'));
  document.getElementById('streetview').style.display = 'none';
  vm.sv = new google.maps.StreetViewService();

  vm.infowindow = new google.maps.InfoWindow()

  /**
   * Promise to ensure the properties have been loaded
   * either from the server or the sharedpropertiesService. The loading is
   * asynchronous so we need a way to ensure that it is done.
   */
  //TODO: Make this less nested
  var propertiesLoadedToVM = new Promise(function(resolve, reject) {
    var getProperties = sharedpropertiesService.getProperties();
    if (getProperties.length > 1){
      vm.markers = getProperties;
      resolve()
    }
    else{
      $http.get('/map').then(function success(res)
      {
        processProperties(res)
        resolve()
      }, function err(res)
      {
        console.log(res)
        reject()
      });
    }
  });

  /**
   * Extracts useful information from property data sent from the server.
   * It then it creates googleMaps markers for each property and saves to vm.
   */
  function processProperties(res){
    var properties = res.data;
    var address="";
    var tmpmarkers = [];
    var propertyname = "";
    var propnamet;
    console.log(properties[0]);

    for (var i = 0; i < properties.length; i++)
    {
      property = properties[i];
      propnamet= "";
      propertyname ="";
      propnamet = property.vitalStreetName.trim();
      propnamet = propnamet.split(" ");
      for (var x = 0; x < propnamet.length; x++)
      {
        propertyname +=" " + propnamet[x][0] +  propnamet[x].slice(1).toLowerCase();
      }
      address =
      property.vitalHouseNumber
      + propertyname;
      ;

      address =
      property.vitalHouseNumber
      + property.vitalStreetName;
      ;
      var propertyLatLng = new google.maps.LatLng(property.latitude,
          property.longitude);
      var propertyMarker = new google.maps.Marker({
        position: propertyLatLng
      });
      tmpmarkers.push(propertyMarker)

      vm.locations.push([address, property.latitude, property.longitude, i])
    }
    vm.markers = tmpmarkers;
    // console.log("these are the markers");
    console.log(vm.markers);
    sharedpropertiesService.setProperties(vm.markers);
  }

  propertiesLoadedToVM.then(setupMap);

  /**
   * Initialize markers, marker clusterer, and panorama and then specify what to do
   * when markers are clicked.
   */
  function setupMap()
  {
    vm.center = vm.map.getCenter();
    vm.sv.getPanorama({location: vm.center, radius: 50}, vm.processSVData);

    for (var i = 0; i < vm.markers.length; i++)
    {
      var propertyMarker = vm.markers[i]
      google.maps.event.addListener(propertyMarker, 'click',
                                    setupPanoramaAtMarkerWrapper(vm, propertyMarker, i));
    }

    var markerCluster = new MarkerClusterer(vm.map,
             vm.markers, {imagePath: 'https://googlemaps.github.io/js-marker-clusterer/images/m'});
  }

  /* We can't get some information from streetview until after we have gotten the panorama.*/
  vm.processSVData = function(data, status) {
    if (status === 'OK') {
      vm.panoramaDate = data.imageDate
      vm.panorama.setPano(data.location.pano);
    } else {
      console.error('Street View data not found for this location.');
    }
  }

  vm.clicked = function()
  {
    console.log('AAAAAAAABBBBB')
    $state.go('bidPage');
  }
}]);

/* Using wrappers here so that I can define the callback function with variables given to the wrapper function */
function setupPanoramaAtMarkerWrapper(vm, propertyMarker, i){
 /**
  * Given a marker position, it finds the nearest streetView panorama and gets it.
  * This is an asynchronous call, so we use a listener that will execute the
  * the pointing of the streetview after we have the panorama (which contains its location).
  */
 function setupPanoramaAtMarker() {
   var markerPosition = propertyMarker.getPosition()
   vm.sv.getPanorama({location: markerPosition, radius: 50}, vm.processSVData);

   google.maps.event.addListenerOnce(vm.panorama, 'status_changed',
                                     pointPanoramaAndSetInfoWindowWrapper(vm, markerPosition, propertyMarker, i));
 }
 return setupPanoramaAtMarker;
}

function pointPanoramaAndSetInfoWindowWrapper(vm, markerPosition, propertyMarker, i){
 /**
  * Once we have gotten all the information we can set the infowindow content
  * and set the point of view or the streetview to point towards the selected marker.
  */
  function pointPanoramaAndSetInfoWindow() {
    address = vm.locations[i][0]
    addressDiv = '<div> Address: '+address+'</div>'
    date = '<div>Image date: ' + vm.panoramaDate+'</div>'
    button = '<div><button id="bidButton">BID</button></div>'

    vm.infowindow.setContent(addressDiv + date + button);
    vm.infowindow.open(vm.map, propertyMarker);
    document.getElementById('streetview').style.display = '';
    // FIXME: Can we do this with angular instead?
    document.getElementById("bidButton").addEventListener("click", vm.clicked);

    vm.sharedpropertiesService.setProperty(address);

    var heading = google.maps.geometry.spherical.computeHeading(vm.panorama.getLocation().latLng,
                                                                    markerPosition);
    vm.panorama.setPov({
      heading: heading,
      pitch: 0
    });
    vm.panorama.setVisible(true);
    setTimeout(function() {
    marker = new google.maps.Marker({
      position: markerPosition,
      map: vm.panorama,
    });
    if (marker && marker.setMap) marker.setMap(vm.panorama);}, 500);
  }

  return pointPanoramaAndSetInfoWindow
}
