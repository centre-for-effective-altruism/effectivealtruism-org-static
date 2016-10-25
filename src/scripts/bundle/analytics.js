(function ($) {
  // track outbound link clicks
  $('a').filter(function () {
    return this.hostname && this.hostname !== window.location.hostname
  }).on('click', function (event) {
    var analytics = window.analytics
    var linkURL = this.href
    var linkTarget = this.target
    if (linkTarget) {
      // if we're opening in a new window, just send a track action
      track(linkURL)
    } else {
      // if we're opening in the same window, send the track action, then open the page
      event.preventDefault()
      track(linkURL, function () {
        window.location.href = linkURL
      })
    }
    function track (linkURL, cb) {
      // guard in case analytics isn't loaded
      if (analytics.initialize) {
        analytics.track('Clicked outbound link', {
          category: 'Links',
          label: linkURL
        }, function () {
          if (typeof cb === 'function') cb()
        })
      } else {
        if (typeof cb === 'function') cb()
      }
    }
  })

  $("#mailchimp-signup-form").on('newsletter_signup',function(event,data){
    var analytics = window.analytics;
    analytics.identify({
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName
    });
    if(data.status==="success"){
      analytics.track("Signed up to Newsletter",{
        category: "Newsletter"
      });
    }
  });
  $('.mailchimp-signup-modal').on('newsletter_modal_shown',function(event){
    var analytics = window.analytics;
    analytics.track("Saw Newsletter popup",{
      category: "Newsletter"
    })
  })

})(jQuery);