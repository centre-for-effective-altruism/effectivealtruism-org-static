// code to make the window scroll smoothly on hash change move back by 
;(function($){
  var navHeight = $('#navbar-main').outerHeight() + 20;
  var scrollHash = function(event) {
      scrollBy(0, -navHeight);
  };
  if (location.hash) scrollHash();
  $(window).on("hashchange", scrollHash);

})(jQuery)

// highlight footnotes when they're clicked
;(function($){
    var t;
    var removeHighlights = function (timeout) {
        timeout = timeout || false;
        clearTimeout(t);
        $('.footnote-item>p,.footnote-ref').removeClass('highlighted')
        if(timeout) {
            t = setTimeout(function(){removeHighlights()},10000)
        }
    }
    var parent = $(document);
    $(parent).on('click','.footnote-ref a',function(){
        removeHighlights(true);
        $($(this).attr('href')+'>p').addClass('highlighted')
    });
    $(parent).on('click','.footnote-backref',function(){
        removeHighlights(true);
        $($(this).attr('href')).parent('sup').addClass('highlighted')
    });

})(jQuery)



// wrapper for `validate` library for consistent form validation handling.
;(function( $, validateLib ){
    $.fn.validate = function(rules, callback) {
        if(typeof rules !== 'object' || typeof rules === null){
            throw new Error ('No rules object provided')
        }

        var el = $(this);

        el.on('submit',function(event){
            event.preventDefault();
            if(validate(el,rules)){
                // run the callback if it's been set, otherwise submit the form
                if(typeof callback === 'function'){
                    callback(el);
                } else {
                    el.submit();
                }
            }
        });

        function validate (form,rules){
            var validationErrors = validateLib(form,rules)
            
            if(validationErrors){
                for (var error in validationErrors) {
                    if(validationErrors.hasOwnProperty(error)) {
                        var el = $('[name='+error+']')

                        el.parent('.form-group,.input-group')
                        .addClass('has-error')

                        el
                        .tooltip('hide')
                        .tooltip('destroy')
                        .tooltip({title:validationErrors[error][0],trigger:"manual",placement:"auto bottom"})
                        .tooltip('show')
                        .on('focus change',function(){
                            $(this)
                            .tooltip('hide')
                            .tooltip('destroy');

                            $(this).parent('.form-group,.input-group')
                            .removeClass('has-error');
                        })
                    }
                }
                return false;
            }
            return true;
        }
    }; 
})( jQuery, validate );

;(function($){
    function tocAffix(){
        var toc = $('#table-of-contents>.table-of-contents-wrapper');
        toc.css('width',toc.outerWidth())
        var nav = $('#navbar-main');
        var content = $('#content');
        var footer = $('#footer');
        var footerOffset = footer.offset().top;
        console.log(footerOffset)
        toc.affix({
            offset: {
                top: content.offset().top - nav.outerHeight(),
                bottom: footer.outerHeight() + 120
            }
        })
    }

    function tocScrollSpy(){
        var nav = $('#navbar-main');
        $('body').scrollspy({ target: '.table-of-contents-wrapper', offset: nav.outerHeight() + 120 })
    }

    function createToc(){
        if ($(window).width() >= window.breakpoints.md){
            tocAffix();
            tocScrollSpy();
        }
    }

    createToc();

})(jQuery);


// // Handler for Mailchimp signup form
// ;(function($,cookies){
//     $(document).on('jsready',function(){
//         $('#mailchimp-signup-subscribe').removeClass('disabled');
//     });

//     var rules = {
//         EMAIL: {
//             email: true,
//             presence: true
//         }
//     };
//     $('#mailchimp-signup-form').validate(rules, function(form){
//         var url = form.attr('action').replace('/post?', '/post-json?').concat('&c=?');
//         var requestData = {};
//         var resultDiv = $('#mailchimp-signup-result');
//         var submitButton = $('#mailchimp-signup-subscribe');
        
//         resultDiv
//         .removeClass('hidden')
//         .removeClass('alert-danger')
//         .removeClass('alert-success')
//         .addClass('alert-info')
//         .text('Processing...');

//         submitButton
//         .addClass('disabled')
//         .removeClass('btn-success')
//         .addClass('btn-default');

//         // based on https://github.com/scdoshi/jquery-ajaxchimp/blob/dev-2.0/src/jquery.ajaxchimp.js
//         $.each(form.serializeArray(), function (index, item) {
//             requestData[item.name] = item.value;
//         });
//         $.ajax({
//                 url: url,
//                 data: requestData,
//                 dataType: 'jsonp'
//         })
//         .done(function (data) {
//             if (data.result === 'success') {
//                 form.find('.controls').addClass('hidden');
//                 resultDiv
//                 .removeClass('alert-danger')
//                 .removeClass('alert-info')
//                 .addClass('alert-success')
//                 .html('<strong>Success:</strong> a confirmation email has been sent to ' + requestData.EMAIL + '. Thanks for subscribing!');

//                 cookies.set('newsletter_subscribed','1',{expires:365});
//             } else{
//                 try {
//                     var parts = data.msg.split(' - ', 2);
//                     if (parts[1] === undefined) {
//                         msg = data.msg;
//                     } else {
//                         msg = parts[1];
//                     }
//                 }
//                 catch (e) {
//                     msg = data.msg;
//                 }
//                 resultDiv
//                 .removeClass('alert-success')
//                 .addClass('alert-danger')
//                 .html("<strong>Error:</strong> "+msg);

//                 submitButton
//                 .removeClass('disabled')
//                 .addClass('btn-success')
//                 .removeClass('btn-default');
//             }
//             form.trigger('newsletter_signup',{
//                 status:     data.result,
//                 email:      requestData.EMAIL,
//                 firstName:  requestData.FNAME, 
//                 lastName:   requestData.LNAME 
//             });
//         });
//     });


// })(jQuery,cookies);
