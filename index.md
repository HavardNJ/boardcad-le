# BoardCAD user guide

## Introduction
BoardCAD is an open source CAD/CAM-system for
surfboards. It is aimed at making the design process easy and intuitive,
allowing the designer to be creative and play with
different designs. The result can be
immediatly visualized in 3D, giving quick feedback.
BoardCAD allows the shaper to print full
scale templates or send the design to a CNC-machine
to have it produced and taken for a ride. It is only in
the water it's possible to validate a design, but knowing
exactly what has been changed between different boards
allows the shaper to learn much more from each of them.
BoardCAD doesn't make you a good
shaper, but used in the right way it can help the inexperienced to
progress faster and the seasoned to become more productive.
This guide on how to use BoardCAD, and a
reference for its funcionality. It is suggested that
you start with the quick tutorial to get a
feeling for the overall workflow and the functionality available. 
The following chapters focus on more specific
topics and can be read in any order. For information on how
to get and install BoardCAD, and for more general
information about the project, we refer to the project's
homepage http://www.boardcad.com and our wiki at
http://www.boardcad.org.

## Overview

This chapter provides an overview of the most important
functionality and the workflow for designing a board, from
defining the basic outline and rocker, to generating and
tuning a board.
### Creating or opening a board
Normally you don't create a board from scratch, but start by
opening one of your existing models. From version 2.0,
BoardCAD mainly works with STEP-files (.stp), but it can still
read and save files in the previous formats (.brd and .cad).
Apart from these native formats, BoardCAD can read files
from aps3000, shape3D, surfcad and akushaper.
The first time you use BoardCAD it is natural that you
don't have any existing models to start from, therefore
BoardCAD comes with three basic shapes (funboard,
shortboard, and longboard) that can serve as a starting
points. You can find them by chosing new in the file menu.
For this tutorial we choose the shortboard. This creates 2D
drawings of the outline, rocker, and a number of cross
sections along the board.
### Editing the curves
The first thing we want to do is to scale the board to the
desired size. If you, like most shapers, have your head
setup to work with feet and inches, you should make sure
that BoardCAD does the same in order to avoid having to
convert all your measures to mm. This can be done from the
drop down list named unit. For this tutorial we choose
Imperial (decimal) as our unit. Now we can comfortably click
the scale button and type in our desired measures, e.g.
5'10" x 20" x 2.25". There is a lot more that can be said
about scaling, but that's a chapter in its own, and for now

## QUICK TUTORIAL
we don't need to care about all the details to get started.
Get ready to start editing our curves. Let's start
with the outline. There are lots of tricks you can use to
facilitate the design, like using another board model or
image of a board as a template. By having them shown in
the background it is easy to trace their outline when editing
the curves. This will be shown later, but here we do
our outline without any aid.
The outline is defined as a Bezier curve which is made up of
a number of segments. Each segment starts at a blue
control point and ends at the next blue control point.
Between those two blue points there is a red and a yellow
point. These define the form of the curve within the specific
segment. You can control the shape of the outline by simply
clicking and dragging the control points. To force the
tangent of the curve to be continuous between two
segments, you can click on the blue control point between
them and mark "continuous".
If needed you can also add or remove control points. While
more control points give more freedom in design it also
make it harder to create smooth lines, so only add guide
points when strictly necessary. Details on how to work with
the control points are given in chapter 5.
Next we define the rocker by clicking on profile. There is
one Bezier curve for the deck and one for the bottom. You
can switch between them by clicking the "Toggle
Deck/Bottom" icon. For the deck it is good practise to follow
the rocker of the blank when possible. Again we refer to
chapter 4 for details on how to show a blank model in the
background, or chapter 11 for instruction on how to scan a
blank using a CNC machine. Here, we use our artistic
freedom to define the rocker. Just as for the outline, we can
edit our curves by clicking and dragging the control points.
It is possible to select several control points and move them
at the same time, which is especially useful for changing the
rocker in the tail and nose while maintaining the same
thickness.
Finally we define our cross sections. The cross sections are
responsible for the form of the rails, and how all the lines
flow in 3D. To ensure a good flow it is advisable to use few
cross sections. One trick is to start with only one cross
section in the center of the board and edit that to the
desired form. Next you add cross section for example at 1
foot from the tail and 1 foot from the nose. These cross
sections will now be copies of the cross section at the center
of the board and it is easy to control how you want the flow
of rail to change towards the tail and towards the nose.
Typically you'll want a harder rail and less tucked under
towards the tail, and a higher rail with more tucked under in
the nose. It may also be necessary to define extra cross
sections for the last few inches of the board. By doing this
after we have edited the cross sections at one foot off the
tail and nose, we again make it easy to change the rail
without breaking the flow.
### Creating a 3D model
Now the main design of the board is already done, and if we
want to print 2D templates (as described in chapter 8) we
can actually do that directly without creating a 3D model. On
the other hand, if we want to use the model in another CADsystem, or have it shaped in a CNC machine, we cannot do
that without a 3D model. In any case, at this point you are
probably eager to see what your board looks like in 3D, so
we simply create a 3D-model by chosing "Approximate from
Bezier" in the 3D-menu. As the name suggests, the 3Dmodel only approximates the 2D curves. The reason for that
is that we want a 3D model that can easilty be modeled
further in order to achieve things such as swallows tails, that
cannot be modelled in 2D. The standard 3D model is able to
approximate most board shapes quite accurately. However, it
is possible to increase the resolution of the 3D-model or edit
the position of its control points in order to improve the
approximation when necessary, see chapter 6 for details.
In version 2 of BoardCAD, the 3D-model is shown directly in
the same window as the Bezier curves. This makes it easy
see how well the curves were approximated. While the 3Dmodel shown in these windows gives a good idea of how the
board looks, an even better visualization is available in the
redered view. To render the board choose "Render nurbs
model" from the Render menu.
Now let us do some editing and create a one inch swallow
tail. First we move the segment placed at 20 mm from the
tail forward so that it does not get affected by the swallow
tail. To move a segment forwared we first have to uncheck
"x-locked" from the popup menu that appears when you do
a right-click on the mouse. Now we can click on the outline
point and drag it forward. Note that since the points are
defined in 3D-space, all views are affected and even the
rocker is changed by moving the segment forward. We can
adjust the rocker either by hand or by reapproximating the
3D-model.
Next we adjust the tail segment to the desired width, and
select "Tail designer" from the 3D menu to set the depth of
the swallow tail. The 3D model always works with mm, so
we type in 25. The result is a retro-looking swallow. We can
fine adjust the tail by selecting "Advanced editing" in the 3Dmenu and move the individual points.
2.4 Saving the board
Finally we save our model. As already stated, BoardCAD
version 2.0 has a new STEP-based file format. To save the
board as a STEP-file, select "Save As" and name the file
using .stp as the file extension. Using this format both the
2D Bezier curves and the final 3D-model are saved in one
single file. Before version 2.0, the 2D model was saved using
.brd-format, and the 3D model using .cad as file extensions.
For backward compatibility these formats are still available.
It is also possible to export the board model using a number
of standard CAD-formats. More information about these can
be found in chapter 9.

## SETTING
PREFERENCES
BoardCAD is intended to be used by anyone who is
interested in designing surfboards, from the backyard
shaper to the full-time professional. Of course, different
users have different needs and preferences. BoardCAD is
therefore highly configurable and it is possible to control
both the visual apperance of the board models and what
kind of design aids you'd like to be present on the screen. It
is also possible to select a different language for the menus.
3.1 Viewing design aids
Under the View-menu you'll find a list of different design
aids that can be switched on and off. While all are useful,
having all shown at the same time tend to clutter the
workspace and make it more difficult to edit the board. Most
of the design aids are self-explanatory, but below you will
find a short description on each of them.
- Shows a grid in the background. Depending on
whether the unit is set to metrics or imperial, the distance
between each grid-line is set to 1 cm or 1 inch respectively.
- Shows the curves of another board in the
background, given that a ghost board has been loaded.
More details on ghost boards are available in chapter 4.
- Shows the curves of the current board
before they were edited.
- Show the control points that allows the
curve to be edited. By hiding these no editing can be done
to the curve. This can be useful when editing the surface
model in order to avoid that the bezier curves get moved by
mistake.

- Show all cross section
simultaneously in the cross section view.
- Guide points are explained in chapter 4.
- The curvature is a measure of how far from
flat a curve is. For a flat line the curvature is equal to zero,
and for other curves the curvature is equal to the inverse of
its radius at every point. This means that if the curvature of
the rocker is equal to zero, the rocker is totally flat at that
point, and if it goes below zero it means that the board has
negative rocker.
- Shows much volume each part of
the board has.
- This shows the volume center
- The sliding info gives information about the
width and thickness of the board at the point where the
mouse is placed.
- Shows the cross section at the
point where the mouse is placed.
- Shows fin position
- Shows a background image if such
image is loaded. More info on backgroud images can be
found in chapter 4.
- Using anti-aliasing smoothens the jagged
lines that occurs due to the low resolution of computer
screens.
- Shows a zero-line under the board
- Shows the distance over
the bottom tail, from the tail and the nose, to the current
mouse position.
- Shows where the cross sections
are placed.
- Shows the flow of the rail at 30, 45, 60, and
90 degrees
- Shows the tucked under
- Shows rocker and width of board at tail,
nose, center, one-foot-off and two-foot-off.
3.2 Setting visual appearance
By choosing Misc, Settings, in the menu you get a dialog
window where it is possible to configurate the visual
appearance of the board model and all the design aids
described above. The dialog window has three tabs.
- In the size and thickness you can control
the size of the control points and the line thickness of the
board model.
- A number of different configurations that didn't fit
under the other tabs. Look and feel lets you set the
appearance of the GUI, in order to give BoardCAD either a
platform independent look and feel like Metal or a native
look and feel that make BoardCAD look more like a native
application and less java-like. Print guide points, and Print
fins, configures whether those will be visible when printing
board information sheets or templates. The fraction
accuracy configures to what fraction of an inch that
measurements will be shown, when imperial units are used.
Default value is 16, i.e. 1/16 of an inch. If Use Rocker Stick
Adjustment is turned on, the rocker will be adjusted so the
center tangent is level. This is similar to the industry
standard way of measuring rocker with a rocker stick. Offset
interpolated cross sections by rocker means that the cross
sections will be drawn in their full 3D-position rather than
flat. This is especially useful when comparing the rail of the
3D-model with the rail of drawn in the 2D-view.
- Let you set the color of the board model and the
different design aids.
### Choosing Bezier interpolation
Finally it is possible to configure how the cross sections are
interpolated in the Bezier model. This affects how new cross
sections will be calculated when a they are added between
two existing cross sections. It also affects how the form of
the sliding cross section, if you have chosen to view this.
The two methods should give similar results, but generally
Cross section interpolation gives the best result if all cross
sections have the same number of control points, while Sblend interpolation is more reliable when different number
of control points are used.
Currently the 3D-model is generated independently, using a
different type of interpolation, and is therefore not affected
by which type of interpolation that is chosen for the Bezier
curves.
### Setting menu language
It is possible to change the language of the menus in
BoardCAD. This is done under the menu Misc, Language.
Currently six languages are supported: English, French,
Portuguese, Spanish, Norwegian, and Dutch. You will need
to restart BoardCAD for the changes to appear.

When designing a new board it is common to get some
inspiration from other designs, by copying for example the
outline, or just comparing the current design with other
designs. Depending on what you have at hand, this can be
done in different ways. If you already have the model of the
other board you can simply put that model in the
background as a Ghost model. If you only have the physical
board, the best thing is take as many measures as possible
(preferable using a scanner as in chapter 11) and add those
as guide points. Even in the case that you only have a
picture of the board it is still possible to use that as a
template by showing the picture in the background. Here we
show you each of these alternatives.
### Ghost board
A ghost board can be loaded in the background to compare
designs. The ghost board can be moved by holding down G
(brings it into focus) and using the arrow keys.
The ghost board can also be scaled to the same size as the
current board using the respective command at the Board
menu.
### Guide points
You can add guidepoints by clicking the Add guide point
button and directly insert the point in the 'board area' by
clicking.
You can also open the Guide points table either via the
Board menu or via Right click of the mouse. Once the table
is open you can directly edit any existing guide points by
## USING TEMPLATES

double clicking. By right clicking the mouse you can choose
to add new guide points via (x,y) coordinates or you can
choose to remove any highlighted guidepoints.
### Background image
A background image can be loaded in every view. This is
positioned by holding down T and clicking on the tail, and
holding down N and clicking on the nose. Note that if the
board is positioned vertically the image needs to be
narrower than wide for this to work properly and visa versa.

## BEZIER EDITING
This chapter gives more detailed information on how to edit
the Bezier curves, i.e. the outline, rocker, and cross sections
of a board.
### General tips for editing curves
The curves are edited by clicking and dragging the control
points. You can also move these points with the keyboard
arrow keys (more precise) or input the exact coordinate in
the respective text boxes (in the lower, right corner) and
click the set button. To make a tangent longer press E
(extend), to make it shorter press R (retract). To rotate the
control point clockwise press W, to rotate it counterclockwise press Q.
By holding down the ALT key you make every editing
operation 1/10th of normal operation. This gives you good
precision even when dragging the points with the mouse.
By clicking while holding down Ctrl or Shift, or by clicking
and dragging a rectangle box around the points you can
select multiple center points that can be moved all together
with the mouse or moved by steps with the keyboard arrow
keys (this is useful for adjusting the rocker without changing
the thickness at the nose tip and tail tip) In the Deck View
select all nose and/or tail control points and drag/move. It's
also useful for adding vee's or concaves without distorting
the rail shape, select all the center points of the rail and
move them together.
The "h" key hides/shows the control points.
Use the < key to cycle through the tangents and center
point of a control point. Use the c key to cycle through the
control points of a curve.
Click add point to go to add point mode. Click on the curve
to add a control point to the curve. The curve will not
change. Click delete point to delete the selected points.
Undo/redo can be done on every change you make to the
curves. The number of operations you can undo is only
limited by available memory.
Pan and zoom by selecting the pan and zoom mode clicking
on the respective buttons. To go back to edit mode (for
selecting control points), press the edit button in the toolbar
or in the right click pop-up menu , or even hit "Esc" on the
keyboard. You can also pan by holding the mouse scroll
wheel button (very useful!) and dragging the board.
Spinning the mouse wheel zooms in and out when in edit
mode.
### Input values
All inputs that take measurements can take the following
formats: FEET/INCHES (ex. 6'10" or 3 1/4"), METERS (ex.
0.5m), CENTIMETERS (ex. 50cm), or MILIMETERS (ex.
2200mm).
If you don't specify a unit, the current unit will be used. In
the case of feet/inches the input value will be inches.
### Outline
Click on the Outline tab to view the outline in a single
window and facilitate the editing. The outline is edited by
clicking and dragging the control points. Normally you will
want to have the Continuous checkbox marked for all control
points. That means that the tangent will be maintained
continuous between different segments of the Bezier curve,
creating a smooth outline. On the other hand, unchecking
continuous will allow you to easily create wingers in the
outline.
### Profile
The deck and bottom rocker are most easily edited in the
Profile tab. If you have access to a model of the blank from
which you intend to shape the board, it is practical to load

the blank model as a ghost board to make sure that the final
board model will fit inside the blank.
The deck and the bottom are edited just like any other
curve. Use the Toggle Deck/Bottom to switch between the
two curves. To change the rocker in the tail or nose without
changing their thickness you can use the Toggle function so
that both curves are opened simultaneously and then mark
both the points on the bottom and the deck before changing
their positions.
### Cross Sections
In the cross section view, the lower view shows the position
of the crossections on the outline. The currently selected
cross section is show with a red line.
Click near any crossection to select it, or use +/- to cycle
through the cross sections. Cross sections can be added,
moved and deleted using the menus.
When adding cross sections the new cross section depends
on the interpolation method used, this setting is in the misc
menu. If blend or S blend interpolation is used, you will get
a copy of the nearest cross section, if control point
interpolation is used the new cross section will be the
interpolated slice at this point. Copy and paste of cross
sections can also be done.
While it is possible to use different number of control points
in each cross sections, it is often easiest to get a good flow
of the rails if the same number of points is used in all cross
sections. To generate high quality 3D-models from the cross
sections it is advised to always leave a slight tucked under
and to use a control point with vertically placed tangent
points at the rail apex.
### Other useful features
* There is a sliding info bar for measurements at any given
point along the length of the board. In it, you can also show
over curve measurements which makes it possible to get
accurate measurements at any given point over the bottom
curve. Very useful to get measurements as exactly as
possible as it's hard to measure on the actual blank unless
you measure over the bottom curve. On the other hand, if
you look at these measurement with regards to the x
position the difference is not that big.
* You can view the curvature of the board to ensure that the
curve is smooth. In particular around a control point the
curvature graph may be discontinous. This may be visible in
a cut board or a template. The curvature graph can also be
used to analyze the curves beyond what is otherwise
possible visually. Note that the sliding info for bottom shows
the radius of the curvature at any point which is also useful
for analyzing the curvature of the rocker. Curvature can be
compared between boards by loading a ghost board, when G
is pressed the curvature of both the current board and the
ghost board are shown (if 'show curvature' is selected).
* If you have zoomed in close and want to see how your
changes affect the greater picture, you can click the spot
check button or space bar to view the entire board, when
you let go it returns to the previous zoom.

## NURBS EDITING
BoardCAD has already from the beginning been using nurbs
surfaces to model the boards in 3D. In the first version that
was released, BoardCAD 0.5, all editing was done directly on
the nurbs surfaces. However, in version 1.0, the user
interface was changed and editing was mainly done in 2D
using Bezier curves, while the 3D functionality was hidden to
the majority of the users. With the release of version 2.0,
the nurbs surfaces has again become more visible. In this
chapter we show how to create nurbs surfaces from the
Bezier curves, and how to edit the nurbs surfaces directly.
### Generating nurbs surfaces
The nurbs surfaces are generated by choosing Approximate
from Bezier in the 3D menu. You can chose to either close
the surface in the tail and nose which gives the deck a
rounded finish, or to simply leave it open which allows the
surface to better approximate the deck line drawn in the 2D
view. Note that the options Approximate outline and rocker,
and Create Bezier patch, are not yet available in version 2.0.
Compared to version 1.0, BoardCAD version 2.0 uses much
less control points in the default surfaces. To still get a good
approximation, the segments are placed closer in the tail
and the nose and more sparse in the center of the board.
Reducing the number of segments is important to get a
model that is small, easy to edit, and fast to cut on a CNCmachine.
As long as the Bezier curves are smooth, the default
surfaces typically gives a good enough approximation of the
Bezier curves. However, if there are some bumps, e.g. in the
outline, it may be necessary to increase the number of
segments. This can be done by selecting Set nr of segments
in the 3D menu. We can also add more segments where

they are needed, or move the existing segments to a
different position. In the example illustrated below we have
increased the number of segments to 25 (default is 7),
added another segment close to the winger, and finally
moved a few of the segments a little closer to the winger.
After this we have done a new approximation from the
Bezier curves. This results in a 3D model very close to the
original 2D curves.
### Simple editing
It is possible to select between simple and advance editing
by clicking on the radio buttons in the 3D menu. When
simple editing is selected only points on the outline are
shown in the outline view and only the central points along
the rocker is shown in the profile view. If advanced editing
all points are shown in the outline and profile view. In the
cross section view all points in the selected segment are
shown indiferently if we have chosen simple or advanced
editing.
When we move an outline point and simple editing is chosen
the width of the whole segment is scaled. Also, is a point is
moved along BoardCAD's x-axis, all points in the same
segment are moved to the same position. This makes it
quick to do larger changes to the model or to fine tune the
model in order to better approximate the Bezier curves.
### Advanced editing
When advanced editing is chosen, each control point can be
moved independently in 3D space. This is especially useful
when working with swallow tails.
### Tail designer
The tail design dialog is useful for creating swallow tails. By
default, the last segment of the nurbs surface is collapsed
into a single point. What the tail designer does is that it
spreads out the points by setting the outline of the tail
segment to the same z-value as the outline of the next
segment. It also moves the center point of the tail segment
forward to the desired position. This gives a good starting
point for further editing the tail.

The first step, before even using the tail design dialog, is to
make sure that the second segment has the width that we
want for the swallow tail. This is done by simply clicking and
dragging the outline point of the segment. We also want to
make sure that the following segments all lies in front of the
swallow tail. In order to move a segment forward we need
to make sure that the x position is not locked. We do this by
right clicking the mouse in the workspace and unmarking
the X locked checkbox. Now we can click and drag the
segment forward. Remember that we need to be in the
simple editing mode in order to move the complete segment
and not only the marked control point.
Now we are ready to use the tail designer, which can be
found under the 3D menu. The tail designer creates a retro
looking swallow tail. Further editing can be done by clicking
and dragging the individual control points. In order to do
that we first switch to advanced editing. The initial and final
swallow tails are illustrated above.
### Rendering 3D models
Finally we can view the 3D model under light using the
Rendered tab. For the board model to appear in the
rendered model we first have to render the nurbs surfaces.
This is done in the Render menu.
It is also possible to view a wireframe model of the board.
## SCALING
Scaling board models is one of the most common
operations, especially when it comes to customizing an
existing model to a specific client. In the simplest form, we
want to scale the whole board by a factor, i.e. to a certain
percentage of the orginal size. However, in many cases we
do not want to scale all dimensions equally. We may, for
example, only want to change the length of a board. This
can be done by scaling the board to a different measure.
In the current implementation the scaling dialog only works
on the 2D-model, i.e. the Bezier curves. Separate functions
are available for scaling the 3D-model.
### Scaling by factor
Scaling by factor is very easy. Bring up the scale dialog by
clicking the Scale board icon, or by choosing Scale current
board in the Board menu. In the Scale dialog, click on the
tab Factor. Now you can simply type in the factor by which
you want to scale the board. To make the board 10% larger
use the factor 1.1, and to make the board 10% smaller -
use the factor 0.9.
Scaling a board by a factor is very simple and it makes sure
that the board model looks exactly as the original board
(just a little bigger or smaller). On the other hand, if you are
not very good with numbers or have a calculator by your
side, it can be hard to predict exactly what will be the final
measures of the board after the scaling is done. Also, the
method is not very flexible as you can not control the
different dimensions independently.
### Scaling to measures
Scaling to measures is a much more powerful function than
scale by factor. However, it has to be used carefully as some
scale operations can result in undesired results such as
bumps or S-decks, especially when scaling thickness and
rocker independently. An extra warning is also issued for
using Contraint proportions together with the imperial unit
(especially if low fraction resolution is used). In those cases
it is preferable to work with Imperial decimal or Metrics.
Both these issues will be explained more in detail below.
First let us have a look at the Scale measures dialog
window. As seen it is possible to enter the measures either
as measured over curve or along a straight line. Next we
have three input fields where we can type in the desired
Length, Width, and thickness of the board. Below we have
three check boxes.
- If checked, changing one of the
measures will also change the others. This means that if you
change the width from 20" to 22" in the dialog window
shown, the length will automatically change to 6'5" and the
thickness to 2,47". The values are updated when you click in
one of the other fields, e.g. the input field for the thickness.
Now, if we are using Imperial with 1/16 as fractional
resolution, the thickness will be rounded to 2 7/16" (which is
only 2,44"). As a result, if we then scale the width back to
20", the board model will be both shorter and thinner than
the original board.
- If checked, the rocker will
change by the same fraction as the thickness. This ensures
that we will not get any bumps in the deck surface as a
result of the scaling. If we change the thickness without
changing the rocker, the deck will rise more in the center of
the board than in the tail and nose. As an example we have
changed the thickness from 2 1/4" to 2 7/8". As can be seen
by the negative curvature the deck gets an undesired Sform.
- If checked, fins positions are
scaled with the same factor as the rest of the board.

## PRINTING
The board templates can be printed in full scale. In addition
a spec sheet page can be printed or saved to an image file.
Printing to pdf is not supported, however a virtual pdf
printer can be used to generate a pdf file.
### Printing specification sheets
You can print a specification sheet by simply clicking the
"Print spec sheet"-icon, or from the submenu Print under
the File menu. The specification sheets can either be sent
directly to the printer or be saved as a file.
### Printing templates
When printing templates, the margins should be adjusted to
the absolute minimum your printer can handle to minimize
the amount of paper used. The difference between a wide
and narrow margin can easily be the difference between one
and two strips of paper being used. If you loose data in the
print, adjust the margins up. You can check the print against
the grid where each square should be an inch. Note that the
printer may distort the image somewhat when print due to
the paper feeder being inaccurate. Therefore it is
recommended that you check the accuracy against the grid.
You can not trust the edge of the paper being true to the
print.
## EXPORTING MODELS
One of the strength of BoardCAD is the possibility to
exchange the board models with third party commercial
CAD/CAM-systems. From version 2.0 we even base our
native file format on STEP. This means that our board
models can now be read directly by most CAD-systems
without the need for exporting the board model. However,
while STEP is an international standard it is still not
supported by all systems. BoardCAD therefore support
several different file format. The board can be exported in
3D in the formats step, dxf and stl to be cut by most
standard CNC machines. To export in these formats you
need to convert the board to 3D first. The board profile and
template can also be exported in two different dxf formats
to be used for cutting foam block with a hotwire cutter or
cutting templates. Here we give a short introduction to the
different formats and what is included in each of them in
order to understand their strenghs and limitations.
### STEP
STEP (ISO 10303 - STandard for the Exchange of Product
models) is an international standard for exchanging CAD
data. This is a very large standard including not only the
geometry model, but also large amounts of meta-data. Due
to the large size, the STEP standard is divided into several
APs (Application Protocols). The geometry data is defined in
AP42, but most CAD-system implements AP203
(Configuration Controlled Design) and AP214 (Automotive
Design).
BoardCAD exports models based on AP203. The exported
model include Bezier curves for outline, rocker, and cross
sections, as well as well nurbs surfaces for the 3D-model.
Most CAD-systems will read the files, but in many cases
only the 3D-model will be shown.

### STL
STL is a file format native to the stereolithography CAD
software created by 3D Systems. This file format is
supported by many other software packages; it is widely
used for rapid prototyping and computer-aided
manufacturing. An STL file describes a raw unstructured
triangulated surface. For BoardCAD this means that the
orginal Bezier curves and nurbs surfaces cannot be
described. Instead a triangulated model of the board is
exported, i.e. the nurbs surfaces are converted into lots of
small triangles. This makes the model very hard to edit
when imported in another CAD-system. However, as long as
the model will not be edited further the triangulated models
work fine.
### DXF
AutoCAD DXF (Drawing Interchange Format, or Drawing
Exchange Format) is a CAD data file format developed by
Autodesk for enabling data interoperability between
AutoCAD and other programs.
With DXF, the 3D-model is limited to triangulated surfaces,
just like in an STL-file, an therefore not suited for further
editing.
Apart from the 3D-model, DXF-files can also export 2D
Bezier curves. This is useful for exporting the outline, rocker,
and cross sections for creating templates.
10. GENERATING AND
EXPORTING G-CODE
With the release of version 2.0, BoardCAD does not only
include full support for CAD (Computer Aided Design), but
also for CAM (Computer Aided Manufacturing). BoardCAD
can be configured to work with most types of 3-axis and 4-
axis CNC machines (see Appendix A for instructions on how
to configure your machine). This chapter gives step by step
instructions on how to generate the G-code that controls the
CNC-machine. All operations are done on the 3D-model and
does not work with Bezier-models. If your boards or blanks
are saved as .brd-files they should first be converted to
NURBS-models and saved with .stp or .cad extension.
G-code is generated separately for the deck and for the
bottom. You can start either by cutting the deck or by
cutting the bottom. Here we start by cutting the deck.
10.1 Placing board model inside the
blank
First we open our blank model. The blank model is just like
any board model and is open through the File menu, Open
board.
It is important to verify that the X-position of the blank
model corresponds to the X-position of real blank in the
machine. The routine for how to do this may differ slightly
between different machines. However, all machines have an
X-position that corresponds to X=0 in BoardCAD and that
should be clearly marked (in Appendix A we show exactly
how to setup this point). Now, if the blank is placed 100 mm
in front of this point, but the blank model is placed at X=0,
we need to translate the blank model to X=100 mm. This is
done with the "Translate X" in the 3D-menu, under the
submenu Transform.
Personally I've premarked the position of each blank size in
the machine, and saved all my blank models in the correct
position, in order to minimize the work.
Now let's assume that the blank model is already in the
correct X-position. The blank is like any board model in
BoardCAD, so the first thing we have to do is to tell
BoardCAD that this model should be used as our blank. This
is done by selecting "Set as blank" in the 3D-menu. When
doing this the model will disappear from the workspace. To
see the blank you have to right click the mouse in
workspace and choose "view blank" in the popup menu.
Next we load the board that we want to cut. The board
model must be placed inside the blank. This can easiest be
done in the profile view. Use the commands "flip board",
"translate x", "translate y", and "rotate" in the 3D menu to
move the board model. One useful trick when rotating a
board is to mark a control point in the board model that the
board will rotate around. If no control point is marked the
board will rotate around origo. Once you have positioned the
board inside the blank it is good practise to save the model
so you don't have to do this again if you want to cut the
same board using the same blank in the future.
### Generating deck cuts
While we have already made sure that the horizontal
position of the blank model corresponds to the horizontal
position of the real blank in the machine, the same has to
be done with the vertical position. This is done with the
funcion "Place blank" in the 3D menu. This function will read
the position of the blank supports from the machine
configuration and move the blank, and the board inside the
blank, until the blank rests on the supports. Now we can
generate the cutting paths for the deck. This is done by
choosing File, G-code, Nurbs to Gcode deck. Enter the file
name for the cutting paths. While the file itself contains
plain text, different machine controllers look for different file
extensions. For example, machine controllers based on
Linux CNC want the file name to end with the extension
.ngc, so here we name the file deck.ngc.
We can visualize the cutting paths by marking "View deck
cuts" in the popup menu.
### Generating bottom cuts
Generating tool paths for the other side of the board is easy.
All we need to do is to choose "Flip board" in the 3D menu,
followed by "Place board". This turns the board and make
sure it is correctly placed on the machine supports. We are
now ready to generate g-code by selecting File, G-code,
Nurbs to Gcode bottom. We name the file bottom.ngc. Again
we can visualize the cutting paths by marking "View bottom
cuts" in the popup menu.
