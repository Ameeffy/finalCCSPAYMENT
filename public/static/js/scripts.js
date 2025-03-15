/*!
    * Start Bootstrap - SB Admin v7.0.7 (https://startbootstrap.com/template/sb-admin)
    * Copyright 2013-2023 Start Bootstrap
    * Licensed under MIT (https://github.com/StartBootstrap/startbootstrap-sb-admin/blob/master/LICENSE)
    */
    // 
// Scripts
// 


window.addEventListener('DOMContentLoaded', event => {

    // Toggle the side navigation
    const sidebarToggle = document.body.querySelector('#sidebarToggle');
    if (sidebarToggle) {
        // Uncomment Below to persist sidebar toggle between refreshes
        // if (localStorage.getItem('sb|sidebar-toggle') === 'true') {
        //     document.body.classList.toggle('sb-sidenav-toggled');
        // }
        sidebarToggle.addEventListener('click', event => {
            event.preventDefault();
            document.body.classList.toggle('sb-sidenav-toggled');
            localStorage.setItem('sb|sidebar-toggle', document.body.classList.contains('sb-sidenav-toggled'));
        });
    }

});


document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token'); // Adjust according to your token storage method

    if (!token) {
        
        window.location.href = 'adminlogin.html';
        return;
    }

    try {
        const response = await fetch('https://finalccspayment.onrender.com/api/auth/admin/details', { // Adjust the URL as necessary
            method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`, // Adjust as needed
                },
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch user data');
            }
            
            const userData = await response.json();
            const profileItem = document.getElementById("profile-item");

            
            profileItem.innerHTML = `<a style="color: #ffffff; text-decoration: none;" href="admin-info.html">${userData.username} (${userData.email}) </a>`;
        } catch (error) {
            console.error('Error fetching user data:', error);
            
            profileItem.innerHTML = `<a href="#">Error loading profile</a>`;
        }
    });

    document.addEventListener('DOMContentLoaded', async () => {
        const token = localStorage.getItem('token');
    
        if (!token) {
            window.location.href = 'adminlogin.html';
            return;
        }
    
        try {
            const response = await fetch('https://finalccspayment.onrender.com/api/auth/admin/details', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
    
            if (!response.ok) {
                throw new Error('Failed to fetch user data');
            }
    
            const userData = await response.json();
            const profileItem = document.getElementById("profile-itemAdmin");
    
            // Check if admin is NOT activated
            if (userData.status !== "Activated") {
                // Show SweetAlert message
                Swal.fire({
                    title: "Access Denied",
                    text: "Your admin account is not activated. Redirecting to Choose Portal...",
                    icon: "warning",
                    timer: 2000, // Show message for 2 seconds
                    showConfirmButton: false,
                    allowOutsideClick: false,
                    didOpen: () => {
                        Swal.showLoading();
                    }
                }).then(() => {
                    // Redirect after SweetAlert message
                    window.location.href = 'chooseportal.html';
                });
                return;
            }
    
            // Display the admin username and email
            profileItem.innerHTML = `<a style="color: #ffffff; text-decoration: none;" href="admin-info.html">${userData.username} (${userData.email}) </a>`;
    
        } catch (error) {
            console.error('Error fetching user data:', error);
            
            // Ensure profileItem is updated if the request fails
            const profileItem = document.getElementById("profile-itemAdmin");
            profileItem.innerHTML = `<a href="#">Error loading profile</a>`;
        }
    });
    

   
    document.getElementById('logout').addEventListener('click', function(event) {
        event.preventDefault();

        Swal.fire({
            title: 'Are you sure?',
            text: "Do you want to log out?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#28a745',
            cancelButtonColor: '#dc3545',
            confirmButtonText: 'Yes, log out!',
            cancelButtonText: 'Cancel'
        }).then((result) => {
            if (result.isConfirmed) {
                localStorage.removeItem('token');
                Swal.fire({
                    title: 'Logged Out!',
                    text: 'You have been logged out successfully.',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    window.location.href = 'adminlogin.html';
                });
            }
        });
    });
    function goBack() {
        window.history.back();  // Goes to the previous page in the browser history
    }

    document.addEventListener('DOMContentLoaded', async () => {
        const token = localStorage.getItem('token');

        if (!token) {
            alert('Unauthorized access. Please log in.');
            window.location.href = 'login.html';
            return;
        }

        const logoElement = document.getElementById('organizationLogo');
        const loadingIcon = document.getElementById('loadingIconLogo');

        try {
            // Fetch organization details to get the photo URL
            const response = await fetch('https://finalccspayment.onrender.com/api/auth/organization/logo', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to fetch organization data.');

            const data = await response.json();

            // Show the logo after it's fully loaded
            const imageUrl = data.photo && data.photo.trim() !== "" ? data.photo : "img/logo.png";

            const img = new Image();
            img.src = imageUrl;
            img.onload = () => {
                logoElement.src = imageUrl;
                logoElement.style.display = "block";  // Show image
                loadingIcon.style.display = "none";  // Hide loading spinner
            };
        } catch (error) {
            console.error('Error fetching organization data:', error);
            logoElement.src = "img/logo.png";  // Fallback to default
            logoElement.style.display = "block";  // Show image
            loadingIcon.style.display = "none";  // Hide loading spinner
        }
    });

    document.addEventListener('DOMContentLoaded', () => {
const logoUpload = document.getElementById('logoUpload');
const organizationLogo = document.getElementById('organizationLogo');
const uploadingMessage = document.getElementById('uploadingMessage');

if (!logoUpload || !organizationLogo) {
console.error("Error: Missing elements for logo upload.");
return;
}

// Attach event listener to logo upload input
logoUpload.addEventListener('change', async (event) => {
const file = event.target.files[0];

if (!file) return;

const formData = new FormData();
formData.append('logoupload', file);

const token = localStorage.getItem('token');
if (!token) {
alert('Unauthorized access. Please log in.');
return;
}

try {
// Show uploading message & SweetAlert loading popup
uploadingMessage.style.display = "block";
Swal.fire({
    title: "Uploading...",
    text: "Please wait while your logo is being uploaded.",
    allowOutsideClick: false,
    showConfirmButton: false,
    didOpen: () => {
        Swal.showLoading();
    }
});

const response = await fetch('https://finalccspayment.onrender.com/api/auth/organization/upload-logo', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData
});

const result = await response.json();

if (response.ok) {
    organizationLogo.src = result.logoUrl;
    Swal.fire({
        title: "Success!",
        text: "Logo updated successfully!",
        icon: "success",
        timer: 2000,
        showConfirmButton: false
    });
} else {
    Swal.fire("Error", result.msg, "error");
}
} catch (error) {
console.error('Error uploading logo:', error);
Swal.fire("Error", "Failed to upload logo.", "error");
} finally {
// Hide uploading message after upload is done
uploadingMessage.style.display = "none";
}
});

// Click on logo to open file picker
organizationLogo.addEventListener('click', () => {
logoUpload.click();
});
});


    
