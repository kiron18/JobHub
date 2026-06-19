![Thumbnail (1920x1080)](https://i.ytimg.com/vi/D3dQqqDx2V4/maxresdefault.jpg)
# [Build a Hermes Knowledge Base That Self-Improves](https://www.youtube.com/watch?v=D3dQqqDx2V4)

**Visibility**: Public
**Uploaded by**: [Jack Roberts](https://www.youtube.com/@Itssssss_Jack)
**Uploaded at**: 2026-06-14
**Published at**: 
**Length**: 14:29
**Views**: 23220
**Likes**: 667
**Category**: Autos & Vehicles

## Description

```
📈 ALL Systems: https://bit.ly/4kol0y5
🩵 Free Resources: https://bit.ly/3RNNDLa
🔥 Type with your voice: https://glaido.com

Hermes has the best memory of any AI agent, but there's one thing it just can't do. Once you fix it, you give Hermes a self-improving knowledge base built on Andrej Karpathy's LLM wiki principles. This is the workflow for anyone who wants Hermes to know your inbox, meeting notes, calls and expert research, not just you. You and I wire up an Obsidian wiki, connect it to Hermes and Claude, and set automatic cron jobs to ingest everything from Granola and NotebookLM. It saves you hours and gets you genuinely further ahead.

*** CORE Software ***
📝 NotebookLM: https://notebooklm.google.com/
☁️ Claude: https://claude.ai/
🧠 Karparthy Wiki: gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
🚀 AntiGravity: https://antigravity.google/
🤖 OpenAI: https://openai.com/
📓 Obsidian: https://obsidian.md/
🎙️ Granola: https://www.granola.ai/

⌚️ Stamps:
00:00 - Hermes Memory Superpowers
00:43 - Why LLMs Feel Like Amnesia
01:18 - How Hermes Memory Works
01:36 - The One Blind Spot
02:22 - A Knowledge Base That Grows
02:40 - Karpathy's LLM Wiki Idea
03:37 - Setting Up Your Wiki
04:02 - Building The Folder Structure
05:41 - The Injection Workflow
06:51 - Connecting The Vault To Hermes
07:54 - Building An Obsidian Skill
09:34 - Indexing Any Article You Find
11:53 - The Two-Way Memory System
12:35 - Auto Ingesting Meetings With Granola
13:45 - Scaling It With Notebooks
14:15 - The Next Piece Of The Puzzle

Build a self-improving Hermes knowledge base with an Obsidian LLM wiki, connect it to Claude and NotebookLM, and set up automatic cron jobs with Granola so your AI agent never forgets your meetings, emails or expert research.
#Hermes #ObsidianRag #NotebookLM #ClaudeCode #AIAgents #LLMWiki
```

## Transcript

Hermes has the best memory of any AI
agent. It remembers your conversations
and gets smarter the more that you use
it. But, there's one thing it can't do.
And once you fix it, you give Hermes
superpowers and unlock completely new
capabilities. So, in this video, I'll
show you exactly how to fix that [music]
to give Hermes a self-improving
knowledge base based on Andre Karpathy's
LLM principles. It'll save you hours of
time and get you light-years ahead of
everybody else. If you're new, I'm Jack.
I built an automatic startup with a
gazillion customers, and now I run my
own AI businesses. And here, I just
share the stuff
>> [music]
>> that actually works. So, if you haven't
already, grab that beautiful coffee, and
let's dive straight in. Now, most LLMs
feel like they have amnesia. They just
forget things randomly. I can mean and
they don't even know that they've
forgotten them. This is why Hermes is so
good. And before you can understand its
limitation and how this actually adds
value. And if you stick with this video
to the end, you will have new
capabilities in your Hermes agent that
will feel completely different and get
you further ahead. But, to do that, we
have to understand what is Hermes memory
and how does it work. So, the best way
to think about it is that Hermes gets
better the more that you physically use
it. It has this loop that is like the
top-level way of doing it. And I've I've
drawn some things you can take pause and
have a look at if you want to.
Fundamentally though, you have a
conversation with Hermes agent, it
writes a note that goes into memory.md
or user.md, and then it recalls it when
you're having conversation. This works
on notices, you know, pulls durable
facts, outbound or internal jump. It
works on files, and it can also recall
and search those things before it
answers you. But, there's one catch, one
limitation to this Hermes system. And
that's the fact that it knows only what
you've said. So, your inbox, your calls,
your docs, your research, these
beautiful YouTubers you followed, all
this great knowledge is invisible to
Hermes. And that is blind spot. It knows
you super well, and I freaking love
Hermes. I talk about Hermes all the
time, but it doesn't have all of this
additional context. It doesn't know, you
know, if you're trying to grow on
Instagram or YouTube, or you're trying
to scale your email marketing system, it
doesn't have that knowledge yet. It
knows you very well, but doesn't have
everything to the right-hand side of the
wall. If you think about it this way,
Hermes knows you, but it doesn't know
your email threads, meeting notes, or
notebook LM. It can, of course, call
those when it's asked to palm, but it's
not in it if you like it's
conversational memory in that sense.
Said another way, Hermes knows you, it
doesn't know your inbox. And so, the
idea to solve this is we want a
knowledge base that grows by itself,
that we can store all of this
information, that Hermes can call and
reference whenever it wants to, and it
can also do very interesting
capabilities that you've not seen
discussed anywhere on this particular
topic, and I'll show you what I mean by
that. So, if you look at Andrej
Karpathy, by the way, co-founder of
OpenAI, if you don't know who I tell you
are, he led AI at Tesla, he's a fan of
Eureka Labs, and he even coined the
expression vibe coder, okay? So, he's
pretty well known in the space. Now, his
idea here was an LLM wiki, you might
have seen it as referred to as Obsidian
Rag, and its core idea with Hermes Agent
is that it rewrites itself as it grows.
So, we can take all of the information
that we want to, right? Like, again,
expert commentary, things that we build
in notebook LM, and effectively, what it
will do is the more we add to it, the
better it gets. As you add it, it checks
linkages, it fact-checks things, and it
basically creates an ever-growing
self-referential,
almost Wikipedia of knowledge for
anything that you want to learn about or
any historical context you have. you
think about it like this, Hermes knows
you, the wiki knows your world, and now
when we combine this with Hermes Agent,
your agent can read both and basically
do very cool things when we wire these
two things together, your world and you.
Think about it from that point of view.
So, now we understand the limitations of
Hermes memory system, the first thing we
need to do is get this beautiful LLM
wiki set up so we can actually reference
this within Hermes and expand its
working knowledge so it can answer
questions about essentially anything
that you want. And by the way, once it's
set up, you can even visualize and see
your entire LLM Wiki Obsidian system all
within your dashboard. It is so freaking
cool. So, the first step we do is head
over to this LLM Wiki. Effectively, what
it is is explaining in detail basically
architecture works, how the system
works, and it's got all of the detail
here, which is freaking awesome. So, all
you're going to literally do is come
down and grab this URL. Then you can
open up your language model of choice.
You can do this in Hermes, but we've
just had Opus 4.8 drop, which is the
world's most capable model as of today.
I've got some interesting thoughts on
that. So, we can use the OAuth inside
the Claude app. What that basically
means is we don't have to spend any API
credits if we're just using the app and
you have the subscription.
Alternatively, you can just open up
Hermes and it can follow these exact
same instructions without a problem. But
for the purposes of this, what I'm going
to do is basically say, "Hey there, I
want you to familiarize yourself with
the idea in this URL, and I want you to
create for me a desktop folder with all
the requisite and let me know once that
is complete." And then we come down and
we simply paste this one in here, and
effectively, it will kind of auto set up
based on the instructions that exist
there. Now, since I already have one set
up, it's found that I saved it as
Obsidian Wiki, and effectively, what it
will do is build out a structure that
looks like this. Just so you can
visualize it a little bit easier, I'm
going to pull up the anti-gravity IDE,
not 2.0 I might add, it's anti-gravity
IDE, just so you understand what this
physically looks like. And as you can
see, I've added various little things in
here like transcripts of various YouTube
videos I think are interesting about,
you know, different strategies for how
to make better content and that kind of
thing, and all of it is within there
itself. And you can ask it questions if
you want to. So, for example, if I'm
querying this Wiki, one of the things I
might do, and as you can see down here,
if you come to claw.md, you can see it's
got the whole structure outlaid here,
and I'll put this claw.md down below for
you as well so you can use this as an
additional thing. But you can see it's
got an injection workflow, so when a new
file is added, it's going to read it,
it's going to discuss it, it's going to
write the source page, okay, and it's
going to update any affected pages and
essentially flag any contradictions. So,
the idea is like if you add a new piece
of knowledge and it contradicts with
something else, we identify those
contradictions and the knowledge base
gets stronger over time. So, then I
might say something like, "Hey there,
dude. Could you just give me two quick
uh tips for making better intros?" Okay,
and it can actually go ahead and search
the Obsidian Wiki. It works exactly the
same in Claude Code. By the way, if this
all sounds like I'm speaking Mandarin,
you can watch this video here for a full
breakdown on exactly what it all means
to build in Claude Code and
Anti-Gravity. But, for the purposes of
this, I'm basically just explaining how
it's all connected. Again, you can also
do this in Hermes Agent. It will set
everything up for you. I'm just showing
you in this environment so you can see
it visually. And as you can see, drawing
a YouTube content strategy synthesis in
your Wiki, here two quickly actionable
tips for loving the intros. There you
go. And it's basically found this info
that information from our Wiki. Now, the
cool thing here is that we can also
ingest anything that we want to. But,
I'm going to show you exactly actually
how you can take this to your novel by
essentially doing all of this within
Hermes. But, to do that, the first thing
we have to do is basically connect this
file this desktop where your personal
Wiki's going to live. And we need to
share that with Hermes. So, if you're
using this dashboard, all you're going
to do is literally come down here and
you'll see the instructions on the
left-hand side here for the Obsidian
Wiki. We basically you just disconnect
this and it will you can just enter in
the location of where your vault is and
then literally just copy this
information here. Now, if you don't
have, okay, the actual um location, you
can just say to Claude or anyone on your
laptop, "Hey, what is the URL location
of this?" And once you've done that, you
can then connect it. So, for example
here, I'll just come and say, "Hey
there, I would like you to reference my
basically my LLM Wiki, my Obsidian
Wiki." Effectively, this is going to
have information that is external to
you. So, you know everything about me.
This is going to be a source of
information knowledge that you can query
in our conversations to better answer my
questions. This is going to be things
like my meeting transcripts, external
insights from experts that are going to
help you basically make better
decisions. Okay. And what I think we can
do here, if you haven't already, and I
recommend you do this, is build out what
we call like a kind of LLM wiki skill or
an Obsidian skill. And effectively, you
can do this if using personas here,
that's freaking awesome. I've covered
that in depth on the channel how you can
just basically add in anything you want
to here. For instance, by clicking on
persona, coming down, picking the
person, naming it here, and this would
be something like, I don't know, LLM
wiki. And here would be use this skill
when answering any questions about
strategy or any contacts about meetings,
notes, that kind of thing. And then just
basically build out a system prompt. And
then you can pick the model that you
want to use to build that out. Now,
interestingly here, you can actually
then, if you just go ahead and update
this, and give this prompt over to
Hermes, it will be fully up to date. You
can also, within Hermes, if you want to,
just effectively ask it build out that
skill. I just like to do this personally
cuz I like to visualize and see all the
skills, so I know exactly what I want to
improve and how I want to physically go
about it. So, for example, if I just
click a feature, I can come down and
test this. Either basically go to my LLM
wiki and just tell me, for example,
three tips on how to make a better
intro. Okay, so we can do this, give
that to Hermes. And now what Hermes is
doing, crucially, is consulting this
ever-growing, self-referential,
self-improving database of knowledge.
Here you go, you come down here, and
it's basically consulted this, and I can
say, "Hey, can I just confirm where did
you get this information from?" And as
you can see, I already can see here, it
read the file exactly where my Obsidian
wiki is, and it found the information
from there. And look, it's gone ahead
and grabbed it. So, effectively, what
we've done now is we've got our own
individual LLM wiki that contains
everything about all the calls that
we've had, maybe it contains things
about knowledge from experts, and then
we have Hermes' own internal memory
system, which is by itself incredible,
and we combine these two things. Now, to
build out your personal LLM wiki, when
would you use that? Well, let me give
you an example. Let's say for example,
you are searching internet and you come
across a website like this. This is high
agency in 30 minutes, which is a
beautiful article by the way, highly
recommend it. What you can do now is
basically have this index. So, let's say
for example that you really like the
principles of high agency and what it
means to be high agency and how much
very valuable. And you kind of want
Hermes to understand this stuff when
you're talking to it. Like maybe you
want to grow on LinkedIn and therefore
you want a LinkedIn master article to be
in Hermes' memory. Well, what we can do
really now is we can copy the text or
copy the article. We can go straight
over to Hermes. Essentially, what we can
do guys is drop it in and be like, "Hey
there, I want you to go ahead and
basically index this article into my
Obsidian wiki." Which means then that it
will reference this and understand this
whenever we physically want to go ahead
and use it. And look, it will just gone
down, it's checked it out. This is
George Mack's high agency in 30 minutes.
Quick tell the offer on the page. Before
I create the source page, what do you
want emphasized? So, I'm going to say,
"What I'd like to do, bro, is basically
embed it into the wiki in line with the
principles set out in that claw.md and
just kind of index it as part of that.
And then from that, it's actually gone
ahead and completely indexed it. So, I
can now ask it questions about high
agency and I'll do that. For example,
what are the criteria of a high agency
person? Okay, I'm going to send this one
off and it will now reference that
Obsidian wiki to pull that information.
As you can see, high agency people are
spotted by four main signals, where
teenage hobbies, treadmill energy,
unpredictable opinions, blah blah blah.
So, the idea here is if you're just
talking to Hermes agent, it will
remember stuff. Remember, Hermes' memory
is incredible. You can even ask
questions, "What did I talk to you about
on the 15th of April?" And it will be
able to pull those specific things. The
difference here with the wiki is this is
an very large knowledge base where we're
indexing it. It's a growing corpus of
knowledge of things that you find
interesting from experts which Hermes
can now reach over, grab, and access.
And the cool thing is if you're ever
working in cloud code, has access to the
same knowledge. So, I can say, "Hey
there, do me a favor. What are the
spokes of a high agency person? This
will will visible in my Obsidian wiki."
And as you can see, it's on the scale
Obsidian ask. It comes on its founder,
which is awesome. And look, it's giving
us all the information that spoke to me
I'm thinking about blah blah blah. So,
now essentially Claude and Hermes' agent
have access to the same memory. And this
is part of the idea of the operating
system that we universalize this
knowledge and everything's connected in
one system rather than having a thousand
different things and a thousand
different interfaces to use. And so, one
of the other cool things that we can do
here and if you think about what we've
done here, we've wired the memory both
ways. So, we can access this LLM Wiki
and we can auto ingest files and data
into this Wiki without polluting the
memory of Hermes' agent, which I'm going
to show you in a second. It's very, very
cool. And we have this beautiful two-way
system giving Hermes this kind of access
to this whole new external system,
external knowledge. And so, if you think
about it, we've got this great
bidirectional relationship. Hermes knows
everything about you and then we have
this LLM Wiki where Hermes itself can
just send things over there. Like, if
you have a really big conversation and
you really want to crystallize that
knowledge, you can essentially just say,
"Hey, index this into my Wiki." So, it
grows this growing corpus of knowledge.
Equally, anything from calendars, Gmail,
meetings, we can just set up auto
basically automatic cron jobs, also
known as just like things that run in
the background to save that. And we can
do that all within Hermes' agent. For
example, I could say, "Hey, what I'd
like like you to do is set up a
recurring task on every day that goes
through to see if I had any new meetings
that are shown in Granola. And if I
have, I'd like it to add those, please,
to my Wiki under kind of like meeting
notes, meeting information. Okay? Go
ahead and save that one off above, which
is really cool. Now, Granola is just the
app that I'm using to basically record
meetings that I go into. They're not
like a sponsor of the video or anything
like that, but they're really cool cuz
it just basically lets you chat to all
of your meetings. And now I'm going to
have this database, all this knowledge I
can just reference whenever I need to.
And there you go, asking us a question.
So, I could say, "Hey, why don't you go
ahead and just run it at 9:00 a.m. every
morning?" And I'll say, "That sounds
like a great place to store it. Just add
it wherever you think would be most
appropriate inside that database." And
just like that, it's now created a job.
So, essentially, every single day now,
that will run, it will check all my
meetings, if I've got any meetings, it's
now added to my LLM Wiki, which is Cap's
whole memory system in a nutshell. And
then we have access to that in Hermes
whenever we want to. And the coolest
thing about this, guys, is you could do
this with Notebooks. Like, you can
connect Notebook LLM to Hermes Agent.
I'll put a video on screen if you
haven't seen that. Or Cloud Code, get
like, you know, 50 to 100 different
areas of like expert knowledge from
Google's number one research and
intelligence platform, I can ingest it
in my local Wiki on my computer, and
then Hermes can just reference that
whenever I want to with this skill. And
Hermes itself can create automations to
ingest it, so your knowledge base just
grows exponentially and will just never
forget the stuff that it needs to know.
Now, memory is great, but it's only one
part of the puzzle. You need to
understand how to leverage all of the
different aspects of Hermes if you want
to get the full capabilities. So, the
next thing I'm going to do is learn
these capabilities by watching this
video right here.