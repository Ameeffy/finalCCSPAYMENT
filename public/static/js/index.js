$(document).ready(function() {
    
    $("a.nav-link").on('click', function(event) {
        if (this.hash !== "") {
            event.preventDefault();
            var target = this.hash;
            var targetOffset = $(target).offset().top - $('.navbar').outerHeight();
            $('html, body').animate({
                scrollTop: targetOffset
            }, 800);

            // Update breadcrumbs
            var sectionTitle = $(this).data('title');
            updateBreadcrumb(sectionTitle);
        }
    });

    function updateBreadcrumb(section) {
        var breadcrumbRoot = $('#breadcrumb-root');
        breadcrumbRoot.html('WELCOME');

        if (section !== 'WELCOME') {
            breadcrumbRoot.after('<li class="breadcrumb-item active">' + section + '</li>');
        } else {
            
            $('.breadcrumb-item:not(#breadcrumb-root)').remove();
        }
    }
});