(function($){
    // track outbound link clicks
    $('a').filter(function() {
       return this.hostname && this.hostname !== window.location.hostname;
    }).on('click',function(event){
        event.preventDefault();
        var analytics = window.analytics;
        var linkURL = this.href;
        var linkTarget = this.target;
        if(analytics.initialize){
            analytics.track('Clicked outbound link',{
                category: 'Links',
                label: linkURL,
            }, function(){
                open(linkURL, linkTarget);
            })
        } else {
            open(linkURL, linkTarget);
        }
        function open(url,target){
            if(target){
                window.open(url, target);
            } else {
                window.location.href = url;
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