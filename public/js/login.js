let userInput = null;
let passInput = null;
let loginBtn = null;
let signUpBtn = null;
let submitStatus = null;

const login = async function (event) {
    event.preventDefault();

    const json = {
        username: userInput.value,
        password: passInput.value
    };
    const body = JSON.stringify(json);

    const response = await fetch('/login', {
        method: 'POST',
        body,
        headers: { "content-type": "application/json" }
    })


    if (await response.headers.get('content-type')?.includes('application/json')) {
        const result = await response.json();
        if (result === undefined || result === null) {
            submitStatus.textContent = "An error occurred when signing in."
        } else if (result.incorrect) {
            submitStatus.textContent = "The username or password was incorrect."
        }
        return;
    } else if (response.redirected) {
        window.location.href = response.url;
    }


}

const signUp = async function (event) {
    // stop form submission from trying to load
    // a new .html page for displaying results...
    // this was the original browser behavior and still
    // remains to this day
    event.preventDefault();

    const json = {
        username: userInput.value,
        password: passInput.value
    };
    const body = JSON.stringify(json);

    const response = await fetch('/signup', {
        method: 'POST',
        body,
        headers: { "content-type": "application/json" }
    })

    const result = await response.json();


    if (result.accountCreated === null || result.accountCreated === undefined) {
        submitStatus.textContent = "An error occurred when signing up."
    } else if (result.accountCreated) {
        submitStatus.textContent = "Successfully signed up " + userInput.value + "!"
    } else {
        submitStatus.textContent = "The user " + userInput.value + " already exists."
    }
}


window.onload = function () {
    userInput = document.querySelector(".username");
    passInput = document.querySelector(".password");
    loginBtn = document.querySelector(".loginBtn");
    signUpBtn = document.querySelector(".signUp");
    submitStatus = document.querySelector(".submitStatus");

    loginBtn.onclick = login;
    signUpBtn.addEventListener("click", signUp);
};
