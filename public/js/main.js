// FRONT-END (CLIENT) JAVASCRIPT HERE

let timeList = null;
let avgList = null;
let reactBtn = null;
let nameBtn = null;
let usrname = "";

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
      usrname = document.querySelector("#yourname").value;
      if (usrname != "") {
        stateWait();
      }
      break;
    case reactStateList["wait"]:
      stateIdle();
      break;
    case reactStateList["press"]:
      const pressTime = Date.now();
      stateWait();
      updateLists(usrname, pressTime - reactStateStartTime, pressTime);
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
  usrname = document.querySelector("#yourname").value;
  if (usrname === "") {
    reactBtn.className = "noName"
    reactBtn.textContent = "Enter your name first!";

  } else {
    reactBtn.className = "idle"
    reactBtn.textContent = "Start";

  }
}

/* Sends and fetches data from server; sending empty name field results in no stored data 
    name: user input name
    ms: reaction time
    time: current local time (unique per user)*/
async function transferData(name, ms, time) {
  json = { name: name, ms: ms, time: time }, body = JSON.stringify(json);

  const response = await fetch("/submit", {
    method: "POST",
    body,
  });
  const arr = await response.json();
  return arr;
}

// Sends data to server and updates time and average time lists after receiving the appropriate data;
// empty name field only updates lists
async function updateLists(name, ms, time) {
  const arr = await transferData(name, ms, time);
  timeList.innerHTML = "";
  for (let n = arr.times.length - 1; n >= 0; n--) {
    const item = arr.times[n];
    const li = document.createElement("li");
    li.dataset.name = item.name;
    li.dataset.timestamp = item.time;
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
    li.dataset.timestamp = item.time;
    li.innerHTML = `<button type="button" class="listBtn deleteAvgBtn">🗑️</button>
                  ${item.name} Avg: ${Math.floor(item.avg)}ms`;
    avgList.appendChild(li);
  }
  document.querySelectorAll(".listBtn").forEach(button => {
    let buttonFunc;
    const name = button.parentNode.dataset.name;
    const timestamp = button.parentNode.dataset.timestamp;
    switch (button.className.split(' ')[1]) {
      case "editBtn":
        const reactMS = button.parentNode.querySelector(".reactMS");
        buttonFunc = function () {
          reactMS.removeAttribute("disabled");
          reactMS.focus();
          reactMS.type = "number"
          reactMS.style.width = "4em";
        }
        reactMS.addEventListener("focusout", () => {
          reactMS.type = "text"
          reactMS.setAttribute("disabled", "disabled");
          putData(Number(reactMS.value), name, timestamp);
        })
        break;
      case "deleteBtn":
        buttonFunc = deleteData("single", name, timestamp);

        break;
      case "deleteAvgBtn":
        buttonFunc = deleteData("all", name, timestamp);

        break;
    }
    button.addEventListener("click", buttonFunc)
  });
  // c) =>nsole.log('arr:', arr)
}

function deleteData(type, name, timestamp) {
  return async function () {
    json = { type: type, name: name, timestamp: timestamp }, body = JSON.stringify(json);

    const response = await fetch("/submit", {
      method: "DELETE",
      body,
    });
    const arr = await response.json();
    // console.log(`Delete: ${type} ${name} ${timestamp}`)
    updateLists("", 0, 0)
  }
}

async function putData(ms, name, timestamp) {
  json = { ms: ms, name: name, timestamp: timestamp }, body = JSON.stringify(json);

  const response = await fetch("/submit", {
    method: "PUT",
    body,
  });
  const arr = await response.json();
  // console.log(`edit: ${type} ${name} ${timestamp}`)
  await updateLists("", 0, 0);
}


window.onload = function () {
  reactBtn = document.querySelector("#reactBtn");
  // nameBtn = document.querySelector('#yournameBtn')
  reactBtn.onclick = submit;
  // nameBtn.onclick = function () {
  //   usrname = document.querySelector('#yourname').value
  // }
  timeList = document.querySelector("#timeList");
  avgList = document.querySelector("#avgList");
  updateLists("", 0, 0);

  document.querySelector('#yourname').addEventListener("change", () => {
    stateIdle()
  })

};
