document.getElementById('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('https://finalccspayment.onrender.com/api/auth/logincollab', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('loginSource', 'adminlogin'); // Mark login source

            let roleMessage;
            if (data.redirectTo === 'admindashboard.html') {
                roleMessage = 'Successfully logged in as Admin';
            } else if (data.redirectTo === 'chooseorganizations.html') {
                roleMessage = 'Successfully logged in as an Organization';
            } else if (data.redirectTo === 'chooseportal.html') {
                roleMessage = 'Successfully logged in as Teacher';
            }

            Swal.fire({
                title: "Success!",
                text: roleMessage,
                icon: "success",
                timer: 1500,
                showConfirmButton: false
            }).then(() => {
                window.location.href = data.redirectTo;
            });
        } else {
            Swal.fire({
                title: "Invalid",
                text: data.msg,
                icon: "warning",
                timer: 2000,
                showConfirmButton: false
            });
        }
    } catch (error) {
        Swal.fire({
            title: "Error!",
            text: 'An error occurred. Please try again.',
            icon: "error",
            confirmButtonText: "Okay"
        });
    }
});
