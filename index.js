'use strict';

const { Component, h, render } = window.preact;
const firebse = window.firebase;


function indexOf(arr, el, def) {
  var idx = arr.indexOf(el);
  return idx < 0 ? def : idx;
}


var GEN_ID_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';


function gen_id() { 
  var now = new Date().getTime(),
      id  = "";
  for (var i = 7; i >= 0; i--) {
    id = GEN_ID_CHARS.charAt(now % 64) + id;
    now = Math.floor(now / 64);
  }
  for (i = 0; i < 12; i++) {
    id += GEN_ID_CHARS.charAt(Math.floor(Math.random() * 64));
  }
  return id;
}


function ref_path(ref) {
  if (ref === null || ref.key === null)
    return "";
  else if (ref.key === "1705_RigaDevDays" || ref.key === "events")
    return ref_path(ref.parent);
  else if (ref.parent.key === null)
    return ref.key;
  else
    return ref_path(ref.parent) + "/" + ref.key;
}


// Last Write Wins register

class LWW {
  constructor(ref, init_value, callback) {
    this.events_ref = ref.child("events");
    this.last_seen = undefined;
    this.max_when = 0;
    
    var lww = this;
    ref.once("value", function(data) {
      if (!data.hasChild("events"))
        lww.set(init_value);

      lww.events_ref.limitToLast(1).on("child_added", function(data) {
        var event = data.val();
        if (event.when > lww.max_when)
          lww.max_when = event.when;
        if (lww.last_seen === undefined || event.when > lww.last_seen.when) {
          lww.log_event("APL", event);
          lww.last_seen = event;
          callback(event.value);
        } else
          lww.log_event("SKP", event);
      });
    });
  }

  log_event(op, event) {
    console.log(op, ref_path(this.events_ref), "{ value: " + event.value + ", when: " + new Date(event.when).toISOString() + " }");
  }

  get() {
    if (this.last_seen !== undefined)
      return this.last_seen.value;
  }

  set(value) {
    var event = { when:  Math.max(new Date().getTime() + clock_skew, this.max_when + 1),
                  value: value };
    this.log_event("SND", event);
    this.events_ref.push().set(event);
  }
}


// Observed-Removed Set

class ORSet {
  constructor(ref, callback) {
    this.events_ref = ref.child("events");
    this.additions = new Map();
    this.retractions = new Map();
    
    this.events_ref.on("child_added", (data) => {
      var event         = data.val(),
          status_before = this.has(event.value);
      this.log_event("APL", event);
      if (event.op === "add") {
        this.add_to(this.additions, event.value, event.tag);
      } else if (event.op === "delete") {
        this.add_to(this.retractions, event.value, event.tag);
      }
      if (this.has(event.value) !== status_before && callback)
        callback(status_before ? "delete" : "add", event.value);
    });
  }

  add_to(map, value, tag) {
    var tags = map.get(value);
    if (!tags) {
      tags = new Set();
      map.set(value, tags);
    }
    tags.add(tag);
  }

  log_event(op, event) {
    console.log(op, ref_path(this.events_ref), "{ op: "+ event.op + ", value: " + event.value + ", tag: " + event.tag + " }");
  }

  has(value) {
    var additions   = this.additions.get(value),
        retractions = this.retractions.get(value);
    if (additions)
      for (var tag of additions) {
        if (!retractions || !retractions.has(tag))
          return true;
      }
    return false;
  }

  add(value) {
    var event = { op: "add", value: value, tag: gen_id() };
    this.log_event("SND", event);
    this.events_ref.push().set(event);
  }

  delete(value) {
    var additions   = this.additions.get(value),
        retractions = this.retractions.get(value);
    if (additions)
      for (var tag of additions) {
        if (!retractions || !retractions.has(tag)) {
          var event = { op: "delete", value: value, tag: tag };
          this.log_event("SND", event);
          this.events_ref.push().set(event);
        }
      }
  }

  count() {
    var count = 0;
    if (this.additions)
      for (var value of this.additions.keys()) {
        if (this.has(value))
          ++count;
      }
    return count;
  }
}


class GSet {
  constructor(ref, callback) {
    this.events_ref = ref.child("events");
    this.values = new Set();
    
    this.events_ref.on("child_added", (data) => {
      var event = data.val();
      this.log_event("APL", event);
      this.values.add(event.value);
      callback(event.value);
    });
  }

  log_event(op, event) {
    console.log(op, ref_path(this.events_ref), "{ value: " + JSON.stringify(event.value) + "}");
  }

  add(value) {
    var event = { value: value };
    this.log_event("SND", event);
    this.events_ref.push().set(event);
  }
}

// CONFIG

var deck_url       = "bit.ly/tonsky-riga", 
    last_question  = null,
    // slides_prefix: "file:///Users/prokopov/Dropbox/Public/conferences/2017.05%20RigaDevDays/jpegs/", 
    // slides_prefix  = "http://s.tonsky.me/conferences/2017.05%20RigaDevDays/jpegs/",
    slides_prefix  = "jpegs/",
    slides         = ["110.jpg", "120.jpg", "122.jpg", "124.jpg", "126.jpg"],// , "130.jpg", "140.jpg", "142.jpg", "144.jpg", "146.jpg", "150.jpg", "160.jpg", "162.jpg", "164.jpg", "170.jpg", "210.jpg", "220.jpg", "225.jpg", "230.jpg", "240.jpg", "280.jpg", "310.jpg", "320.jpg", "330.jpg", "340.jpg", "350.jpg", "360.jpg", "370.jpg", "380.jpg", "390.jpg", "410.jpg", "420.jpg", "430.jpg", "450.jpg", "455.jpg", "460.jpg", "461.jpg", "462.jpg", "463.jpg", "464.jpg", "465.jpg", "466.jpg", "470.jpg", "480.jpg", "510.jpg", "512.jpg", "514.jpg", "516.jpg", "518.jpg", "520.jpg", "522.jpg", "524.jpg", "526.jpg", "527.jpg", "528.jpg", "530.jpg", "532.jpg", "540.jpg", "550.jpg", "560.jpg", "570.jpg", "580.jpg", "590.jpg", "610.jpg", "612.jpg", "614.jpg", "616.jpg", "618.jpg", "620.jpg", "622.jpg", "624.jpg", "626.jpg", "640.jpg", "643.jpg", "645.jpg", "647.jpg", "650.jpg", "660.jpg", "670.jpg", "672.jpg", "674.jpg", "676.jpg", "680.jpg", "710.jpg", "720.jpg", "725.jpg", "730.jpg", "740.jpg", "750.jpg", "760.jpg", "770.jpg", "810.jpg", "812.jpg", "814.jpg", "816.jpg", "818.jpg", "820.jpg", "825.jpg", "830.jpg", "832.jpg", "834.jpg", "836.jpg", "838.jpg", "840.jpg", "850.jpg", "860.jpg", "862.jpg", "870.jpg", "872.jpg", "880.jpg", "882.jpg", "884.jpg", "910.jpg", "915.jpg", "920.jpg", "930.jpg", "940.jpg", "942.jpg", "944.jpg", "946.jpg", "948.jpg", "960.jpg"],
    slides_ratio = 16/9,
    slides_loaded = 0,
    slides_failed = 0,
    screen = "deck";


// DATABASE

firebase.initializeApp(
  { apiKey:            "AIzaSyBSvbyk9BAbG0b0EY9-uRu97ms-0GP1hfI",
    authDomain:        "slides-551fe.firebaseapp.com",
    databaseURL:       "https://slides-551fe.firebaseio.com",
    projectId:         "slides-551fe",
    storageBucket:     "slides-551fe.appspot.com",
    messagingSenderId: "483497773461" });

var database = firebase.database(),
    $root = database.ref("1705_RigaDevDays");


// USER

var is_speaker = location.search === "?speaker=true",
    user_id    = localStorage.getItem("user_id");
if (!user_id) {
  user_id = gen_id();
  localStorage.setItem("user_id", user_id);
}
console.log("user_id =", user_id);
  
    
// CLOCK SKEW

var clock_skew = 0;
database.ref(".info/serverTimeOffset").on("value", (s) => clock_skew = s.val());


// CURRENT SLIDE

var $speaker_slide    = new LWW($root.child("speaker_slide"), slides[0], on_speaker_slide_change),
    current_slide_idx = 0,
    last_revealed_idx = 0,
    last_idx          = slides.length - 1,
    is_following      = true;


function on_speaker_slide_change(speaker_slide) {
  var speaker_idx = indexOf(slides, speaker_slide, 0);
  if (speaker_idx > last_revealed_idx)
    last_revealed_idx = speaker_idx;
  if (is_following)
    current_slide_idx = speaker_idx;
  rerender();
}


function change_slide(delta) {
  var new_idx = Math.max(0, Math.min(is_speaker ? last_idx : last_revealed_idx, current_slide_idx + delta));
  if (new_idx !== current_slide_idx) {
    if (is_speaker)
      $speaker_slide.set(slides[new_idx]);
    else {
      current_slide_idx = new_idx;
      is_following = new_idx === last_revealed_idx && slides[new_idx] === $speaker_slide.get();
      rerender();
    }
  }
}


function follow_speaker() {
  current_slide_idx = indexOf(slides, $speaker_slide.get(), 0);
  is_following = true;
  rerender();
}


// PRESENCE

var online    = 0,
    connected = false,
    $online   = $root.child("online");


database.ref('.info/connected').on("value", (s) => {
  if (s.val()) {
    $online.child(user_id).set(true);
    $online.child(user_id).onDisconnect().remove();
    connected = true;
    rerender();
  } else
    connected = false;
    rerender();
});


$online.on("child_added", (_s) => { online++; rerender(); });
$online.on("child_removed", (_s) => { online--; rerender(); });


// LIKES

var likes = new Map();

for (var slide of slides) {
  var slide_key = slide.replace(/[.$\/\[\]#]/, "_");
  likes.set(slide, new ORSet($root.child("likes/" + slide_key), (_op, _user_id) => rerender()));
}


// VIEW

var app,
    render_pending = false;


function rerender() {
  if (!render_pending) {
    requestAnimationFrame(() => { render_pending = false; app.forceUpdate(); });
    render_pending = true;
  }
}


class Slide extends Component {
  constructor() {
		super();
		this.state = { visible: false,
                   loaded: false };
	}
  load() {
    var img = new Image();
    img.onload = () => { this.loaded = true; slides_loaded++; rerender(); };
    img.onerror = () => { this.loaded = true; slides_failed++; rerender(); };
    img.src = slides_prefix + slides[this.props.pos];
    this.state.image = img;
  }
  is_visible() {
    return this.props.pos === current_slide_idx - 1 ||
           this.props.pos === current_slide_idx     || 
           this.props.pos === current_slide_idx + 1;
  }
  componentWillMount() {
    if (is_speaker || this.is_visible())
      this.load();
    this.componentWillUpdate();
  }
  componentWillUpdate() {
    if (this.is_visible())
      this.setState({ visible: true });
  }
  render(props, state) {
    var cls = props.pos < current_slide_idx ? "slide_exit" :
              props.pos > current_slide_idx ? "slide_enter" :
                                              "slide_current",
        src = this.is_visible() || state.visible ? "url(" + slides_prefix + props.slide + ")" : "";
    return h('div', {class: "slide " + cls, 
                     id:    "slide_" + props.pos,
                     style: { backgroundImage: src }});
  }
  componentDidUpdate() {
    if (this.state.visible && !this.is_visible())
      setTimeout(() => this.setState({ visible: false }), 1000);
  }
}


var screen_width,
    screen_height,
    deck_width,
    deck_height,
    statusbar_height = 40;


function resize(_event) {
  screen_width = document.documentElement.clientWidth;
  screen_height = document.documentElement.clientHeight - statusbar_height;
  [deck_width, deck_height] = screen_width / slides_ratio > screen_height
    ? [screen_height * slides_ratio, screen_height]
    : [screen_width, screen_width / slides_ratio];
  rerender();
}


class Deck extends Component {
  componentWillMount() {
    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("keydown", handle_keyboard);
  }

  render(props, state) {
    return h("div", { class: "deck", 
                      style: { width:  deck_width, 
                               height: deck_height, 
                               left:   (screen_width - deck_width) / 2,
                               top:    (screen_height - deck_height) / 2 }},
             slides.map((name, pos) => {
               return h(Slide, { key: name, slide: name, pos: pos });}))
  }

  componentWillUnmount() {
    window.removeEventListener("resize", resize);
    document.removeEventListener("keydown", handle_keyboard);
  }
}

const GoBack = () => {
  return current_slide_idx === 0 ? null :
    h("div", { key: "go_back", 
               class: "go go_back",
               style: { width:  (screen_width - deck_width) / 2 + deck_width * 0.33333333,
                        top:    (screen_height - deck_height) / 2,
                        height: deck_height },
               onclick: () => change_slide(-1) });
}


const GoForward = () => {
  return current_slide_idx >= (is_speaker ? last_idx : last_revealed_idx) ? null :
    h("div", { key: "go_forward",
               class: "go go_forward",
               style: { width:  (screen_width - deck_width) / 2 + deck_width * 0.33333333,
                        top:    (screen_height - deck_height) / 2,
                        height: deck_height },
               onclick: () => change_slide(1) });
}


const LikeButton = () => { 
  var $set  = likes.get(slides[current_slide_idx]),
      liked = $set.has(user_id);
  return h("div", { class: "button like-button" + (liked ? " like-button_liked" : ""),
                    onclick: () => liked ? $set.delete(user_id) : $set.add(user_id) },
            // "Slide " + slides[current_slide_idx] + " × ",
            liked ? "Liked!" : "Like this slide");
};


const AskButton = () => { 
  return h("div", { class: "button ask-button",
                    onclick: () => { screen = "ask"; rerender(); } },
          "Questions");
};


const FollowButton = () => { 
  if (!is_following) {
    return h("div", { class: "button follow-button",
                      onclick: follow_speaker },
              "Follow speaker");
  }
};


const StatusBar = (props) => {
  var likes_count = likes.get(slides[current_slide_idx]).count();
  return h("div", { class: "status" },
           h("div",  { class: "status-likes" }, "" + likes_count),
           h("div",  { class: connected ? "status-online" : "status-offline" }, "" + online),
           is_speaker ? h("span", { class: "status-url" }, 
                          h("a", {href:"http://" + deck_url, target: "_blank"}, deck_url)) : null,
           h("span", { class: "status-question" }, last_question));
}


function handle_keyboard(e) {
  switch(e.keyCode) {
    case 34: // page down
    case 32: // space
    case 39: // right
    case 40: // down
      change_slide(1);
      e.preventDefault();
      break;
    case 33: // page up
    case 37: // left
    case 38: // up
      change_slide(-1);
      e.preventDefault();
      break;
  }
}

// ASK SCREEN

var question_upvotes = new Map(),
    $questions = new GSet($root.child("questions"),
                          (question) => {
                            var $upvotes = new GSet($root.child("upvotes/" + question.id), (_user) => {
                              last_question = question.text;
                              rerender();
                            });
                            question_upvotes.set(question.id, $upvotes);
                            last_question = question.text;
                            rerender();
                          });


const QuitAskButton = () => { 
  return h("div", { class: "button quit-ask-button",
                    onclick: () => { screen = "deck"; rerender(); } },
            "← Back to slides");
};


function ask_form_ta() {
  return document.querySelector(".ask-form-ta");
}


function submit_question(text) {
  if (text !== "")
    $questions.add({ id: gen_id(), text: text, author: user_id });
}


class AskForm extends Component {
  constructor() {
    super();
    this.state = { expanded: false };
  }
  
  render(props, state) {
    var expanded = true; // this.state.expanded;
    return h("div", { class: "ask-form" },
             h("textarea",
               { class:       "ask-form-ta" + (expanded ? " ask-form-ta_expanded" : ""),
                 onfocus:     (e) => { this.setState({ expanded: true }); },
                 placeholder: expanded ? "Your question to speaker" : "Ask speaker" }),
             expanded
               ? h("button",
                   { class: "button ask-form-button",
                     onclick: () => { 
                       submit_question(ask_form_ta().value);
                       ask_form_ta().value = "";
                       this.setState({ expanded: false });
                     }},
                   "ASK")
               : null);
  }
};

class Question extends Component {
  render(props, state) {
    var q = props.question,
        $upvotes = question_upvotes.get(q.id),
        upvotes = $upvotes.values,
        upvoted = upvotes.has(user_id) || q.author === user_id;
    return h("div", { class: "question" }, 
             h("div", { class: "question-text" }, q.text),
             upvotes.size > 0 ? h("div", { class: "question-upvotes" }, upvotes.size) : null,
             upvoted || is_speaker ? null : h("div", { class: "button question-upvote-button" + (upvotes.size === 0 ? " question-upvote-button_right" : ""),
                                         onclick: () => $upvotes.add(user_id) }));
  }
}

function sort_by(arr, keyfn1, keyfn2) {
  return arr.sort(function(a,b) {
    return keyfn1(a) > keyfn1(b) ? -1 : keyfn1(a) < keyfn1(b) ? 1 : keyfn2(a) > keyfn2(b) ? -1 : keyfn2(a) < keyfn2(b) ? 1 : 0;
  });
}

const Questions = (props, state) => {
  var qs = Array.from($questions.values);
  sort_by(qs, (q) => question_upvotes.get(q.id).values.size, (q) => q.id);
  return h("div", { class: "questions" },
           qs.map((q) => h(Question, { key: q.id, question: q})));
}

// PRELOADER

const Message = (props, state) => {
  return h("div", { class: "loader" },
           h("span", { class: "loader-inner" },
             props.children));
}


const PreloadStatus = (props) => {
  return h(Message, {}, "Loading slides " + (slides_loaded+1) + " of " + slides.length + " (" + slides_failed + " errors)...");
}


class App extends Component {
  componentDidMount() {
    window.app = this;
  }
  render(props, state) {
    if (!$speaker_slide.get()) 
      return h(Message, {}, "Connecting to Firebase...");
    else if (screen === "deck")
      return h("div", { class: "app app_deck" }, 
               h(Deck),
               h(GoBack),
               h(GoForward),
               h(StatusBar),
               is_speaker ? null : h(FollowButton),
               is_speaker ? null : h(LikeButton),
               is_speaker && last_revealed_idx < last_idx ? null : h(AskButton), 
               (is_speaker && slides_loaded + slides_failed < slides.length ? h(PreloadStatus, {}) : null));
    else if (screen === "ask")
      return h("div", { class: "app app_ask" },
               h("div", { class: "app-inner_ask" },
                 h(QuitAskButton),
                 is_speaker ? null : h(AskForm),
                 is_speaker ? null : h("div", { class: "questions-hr" }),
                 h(Questions) ));
  }
}


render(h(App), document.querySelector(".mount"));