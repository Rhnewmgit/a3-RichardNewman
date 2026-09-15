// FRONT-END (CLIENT) JAVASCRIPT HERE

let timeList = null;
let avgList = null;
let reactBtn = null;
let nameBtn = null;
let playername = "";
let resetBtn = null;
let userName = "";

const reactStateList = {
  idle: 0,
  wait: 1,
  press: 2,
};

// current state of reaction button
let reactState = reactStateList["idle"];
// when the reaction started
let reactStateStartTime = Date.now();
// duration that the active state should last
let reactDuration = 0;
// timeout ID for when the current state is set to change
let reactTimeoutID = -1;

const submit = async function (event) {
  event.preventDefault()
  switch (reactState) {
    case reactStateList["idle"]:
      playername = document.querySelector("#yourname").value;
      if (playername != "") {
        stateWait();
      }
      break;
    case reactStateList["wait"]:
      stateIdle();
      break;
    case reactStateList["press"]:
      const pressTime = Date.now();
      stateWait();
      sendTimeAndUpdate(playername, pressTime - reactStateStartTime, pressTime);
      break;
  }
};

// sets state and timeout to change to statePress
function stateWait() {
  clearTimeout(reactTimeoutID);
  // reactStateStartTime = Date.now()
  reactTimeoutID = setTimeout(statePress, Math.floor(Math.random() * 5000) + 2500);
  reactState = reactStateList["wait"];
  reactBtn.className = "wait"
  reactBtn.textContent = "wait...";
}

// sets state, start time, and sets 5s timeout to return to the main menu
function statePress() {
  clearTimeout(reactTimeoutID);
  reactState = reactStateList["press"];
  reactStateStartTime = Date.now();
  reactTimeoutID = setTimeout(stateIdle, 3000);
  reactBtn.className = "press"
  reactBtn.textContent = "PRESS";
}

// Returns to 0 button pressing state
function stateIdle() {
  clearTimeout(reactTimeoutID);
  reactState = reactStateList["idle"];
  playername = document.querySelector("#yourname").value;
  if (playername === "") {
    reactBtn.className = "noName"
    reactBtn.textContent = "Enter your name first!";

  } else {
    reactBtn.className = "idle"
    reactBtn.textContent = "Start";

  }
}

/**
 * Sends time data to the server, returning an object containing res1 and res2, which correspond to the ack and the modified average, respectively;
 *  name: user input name
 *  ms: reaction time
 */
async function sendNewTimeData(name, ms) {
  json = { name: name, ms: ms, user: userName }, body = JSON.stringify(json);

  const response = await fetch("/submit", {
    method: "POST",
    body,
    headers: { "content-type": "application/json" }
  });
  const arr = await response.json();
  return arr;
}

/**
 * Sends time data to the server and receives the updated list  
 *  name: user input name
 *  ms: reaction time
 */
async function sendTimeAndUpdate(name, ms) {
  let arr = await sendNewTimeData(name, ms);
  await updateLists(arr);
}


/**
 * Retrieves all database document
 */
async function getDBDocuments() {
  const response = await fetch("/docs", {
    method: "GET",
  });

  const arr = await response.json();
  return arr;
}

async function getUser() {
  const response = await fetch("/user", {
    method: "GET",
  })

  const arr = await response.json();
  userName = arr.user;
  document.querySelector("#yourname").value = userName;
  stateIdle();
  document.querySelector(".currentUserLogoutBtn").textContent = "Logout " + userName;
}


// updates time and average time lists with given object holding a list of times and averages
async function updateLists(arr = null) {
  if (arr === null) {
    arr = await getDBDocuments();
  }
  timeList.innerHTML = "";
  for (let n = arr.times.length - 1; n >= 0; n--) {
    const item = arr.times[n];
    const li = document.createElement("li");
    li.dataset.name = item.name;
    li.dataset._id = item._id;
    li.innerHTML = `<button type="button" class="listBtn editBtn">✏️</button>
                  <button type="button" class="listBtn deleteBtn">🗑️</button>
                  ${item.name}: 
                  <input class="reactMS" type="text" name=reactMS value=${item.ms} disabled></input>
                  ms`;
    li.querySelector('input').style.width = `${0.6 * Math.floor(Math.log10(item.ms) + 1)}em`
    timeList.appendChild(li);
  }
  avgList.innerHTML = "";
  for (item of Object.values(arr.averages)) {
    const li = document.createElement("li");
    li.dataset.name = item.name;
    li.dataset._id = item._id;
    li.innerHTML = `<button type="button" class="listBtn deleteAvgBtn">🗑️</button>
                  ${item.name} Avg: ${Math.floor(item.avg)}ms`;
    avgList.appendChild(li);
  }
  document.querySelectorAll(".listBtn").forEach(button => {
    let buttonFunc;
    const name = button.parentNode.dataset.name;
    const _id = button.parentNode.dataset._id;
    switch (button.className.split(' ')[1]) {
      case "editBtn":
        const reactMS = button.parentNode.querySelector(".reactMS");
        buttonFunc = () => {
          button.setAttribute("disabled", "disabled");
          reactMS.removeAttribute("disabled");
          reactMS.focus();
          reactMS.type = "number"
          reactMS.style.width = "4em";
        }
        reactMS.addEventListener("focusout", () => {
          button.removeAttribute("disabled");
          reactMS.type = "text"
          reactMS.setAttribute("disabled", "disabled");
          putData(Number(reactMS.value), _id);
        })
        break;
      case "deleteBtn":
        buttonFunc = deleteData(button, "single", name, _id);

        break;
      case "deleteAvgBtn":
        buttonFunc = deleteData(button, "all", name, _id);

        break;
    }
    button.addEventListener("click", buttonFunc)
  });
}

function deleteData(button, type, name, _id) {
  return async function () {
    button.setAttribute("disabled", "disabled");
    let json = { type, name, _id };
    let body = JSON.stringify(json);

    const response = await fetch("/remove", {
      method: "DELETE",
      body,
      headers: { "content-type": "application/json" }
    });

    const arr = await response.json();
    if (arr === null || !arr.acknowledged) {
      button.removeAttribute("disabled");
    }
    await updateLists(arr);
  }
}

async function putData(ms, _id) {
  json = { ms: ms, _id: _id, user: userName }, body = JSON.stringify(json);

  const response = await fetch("/edit", {
    method: "PUT",
    body,
    headers: { "content-type": "application/json" }
  });
  const arr = await response.json();
  await updateLists(arr);
}

/**
 * Remove all data for the user and fill with sample data
 */
async function resetToSample(event) {
  event.target.setAttribute("hidden", "true");
  const response = await fetch("/reset", {
    method: "DELETE",
  });
  const arr = await response.json();
  await updateLists(arr);
  resetBtn.removeAttribute("hidden");
}


window.onload = function () {
  getUser();
  reactBtn = document.querySelector("#reactBtn");
  // nameBtn = document.querySelector('#yournameBtn')
  reactBtn.onclick = submit;
  // nameBtn.onclick = function () {
  //   usrname = document.querySelector('#yourname').value
  // }
  timeList = document.querySelector("#timeList");
  avgList = document.querySelector("#avgList");

  updateLists();
  document.querySelector('#yourname').addEventListener("change", () => {
    stateIdle()
  })

  resetBtn = document.querySelector("#resetBtn");
  let areYouSureBtn = resetBtn.nextElementSibling;
  resetBtn.addEventListener("click", () => {
    resetBtn.setAttribute("hidden", "true");
    areYouSureBtn.removeAttribute("hidden");
    setTimeout(() => {
      areYouSureBtn.setAttribute("hidden", "true");
      resetBtn.removeAttribute("hidden");
    }, 4000);
  })
  areYouSureBtn.addEventListener("click", resetToSample);

};
