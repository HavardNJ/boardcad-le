# BoardCAD user guide

![BoardCAD](./images/BoardCAD full - 3D.png?raw=true)

## Introduction
BoardCAD is an open source CAD/CAM-system for
surfboards. It is aimed at making the design process easy and intuitive,
allowing the designer to be creative and play with
different designs. The result can be
visualized in 3D for quick feedback.
BoardCAD allows the shaper to print full
scale templates or have the board CNC-machined. A board can only be
validated in the water, but knowing
exactly what has been changed between different boards
allows the shaper to learn more from each of them.
BoardCAD doesn't make you a good
shaper, but used in the right way it can help the inexperienced
progress faster and the seasoned to become more productive.
Start with the quick tutorial to get a
feeling for the overall workflow and the functionality available, the go more in detail.
For information on how to download and install BoardCAD see [downloading and installing](/download-install.md).
For more general information about the project and contributing see LINK HERE

# Overview
This chapter provides an overview of the most important
functionality and the workflow for designing a board by
defining the basic outline, rocker and cross sections.

## QUICK TUTORIAL

### Creating a new board
The first time you use BoardCAD it is natural that you
don't have any existing models to start from.
BoardCAD comes with three basic shapes (funboard,
shortboard, and longboard) that serve as starting
points. You create a new board from new in the file menu.
Don't worry too much if the shape you start with is far from
what you had in mind, you can make any board from any starting point.

### Scale the board
The first thing we want to do is to scale the board to the
desired size. If you are used to working with feet and inches like most shapers, 
make sure that you select imperial units in the dropdown on the toolbar.
Now click the scale button and type in the desired measures, f.ex.
5'10" x 20" x 2.25". Note that you can input dimension either in fractions or
decimals regardsless of what unit is selected. You can also input values in
other units such as mm or m as long as you provide the unit.

### Editing the board
Start with the outline. 
The outline is defined as a Bezier curve made up of
segments. Each segment starts at a blue
control point and ends at the next blue control point.
Between those two blue points there is a red and a yellow
control point. These define the form of the curve within the specific
segment. You can control the shape of the outline by
clicking and dragging the control points. To ensure the
the curve is continuous between two segments, click a control point to
select it and check "continuous" in the lower right corner.
You can add or remove control points by right clicking to open the menu and
selecting the add control point option from the pop up menu. After selecting,
click anywhere on the curve to add a control point. 

> ![Info](./images/info.png?raw=true) When adding a control point the curve remains the same.

Click on profile tab to work on deck and rocker. You
can switch between deck and rocker by clicking the "Toggle
Deck/Bottom" icon or hotkey B.
Multiple control points can be selected and moved
at the same time, which is useful for changing the
rocker in the tail and nose while maintaining the same
thickness. Select multiple control point by dragging a box around
them or by clicking multiple control points while holding down CTRL.
The cross sections are responsible for the form of the rails, and how all the lines
flow in 3D. To ensure a good flow it is advisable to use few
cross sections. One trick is to start with only one cross
section in the center of the board and edit that to the
desired form. Next you add cross section for example at 1
foot from the tail and 1 foot from the nose. These cross
sections will now be copies of the cross section at the center
of the board and it is easy to control how you want the flow
of rail to change towards the tail and towards the nose.
It may also be necessary to define extra cross
sections for the last few inches of the board. By doing this
after we have edited the cross sections at one foot off the
tail and nose, we again make it easy to change the rail
without breaking the flow.

## SETTING
PREFERENCES
BoardCAD is intended to be used by anyone who is
interested in designing surfboards. Different
users have different needs and preferences. BoardCAD is
configurable and you can control
the visual apperance of the board models and what
design aids you'd like to be present on the screen. BoardCAD also support different languages.

3.1 Viewing design aids
Under the View-menu you'll find a list of different design
aids that can be switched on and off. While all are useful,
having all visible at the same time clutter the
workspace creating visual noise and make it difficult to edit the board. Most
of the aids are easy to understand:
- Shows a grid in the background. Depending on
whether the unit is set to metrics or imperial, the distance
between each grid-line is set to 1 cm or 1 inch respectively.
- Shows ghost board in the
background. See ghost board.
- Shows the curves of the current board before they were edited.
- Show the control points that allows the
curve to be edited. By hiding these no editing can be done
to the curve, but viewing the curve without any visual noise
can be useful.

- Show all cross section simultaneously in the cross section view.
- Show Guide points. See guidepoints.
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
It is possible to configure how the cross sections are
interpolated in the Bezier model. This affects the form of
the sliding cross section, if you have chosen to view this and
how the 3D model is generated.
The two methods should give similar results, but 
cross section interpolation gives best result if all cross
sections have the same number of control points, S-blend 
interpolation is more reliable when different number of control 
points are used.

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
holding down N and clicking on the nose.

## EDITING
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

## PRINTING
Board templates can be printed in full scale. In addition
a spec sheet page can be printed or saved to an image file.
Printing to pdf is currently not supported, but a virtual pdf
printer can be used to generate pdf files.

### Printing spec sheets
You can print a spec sheet by clicking the
"Print spec sheet" icon in the toolbar, or from the submenu Print in
the File menu.

### Printing templates
When printing templates, the margins should be adjusted to
the absolute minimum your printer can handle to minimize
the amount of paper used. The difference between a wide
and narrow margin can be the difference between one
and two strips of paper being used. If you loose data in the
print, adjust the margins up.
Note that printers may distort the image when print due to
the paper feeding mechanism being inaccurate. It is
recommended that you check the accuracy against the grid 
where each square should be an inch.

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

## GENERATING AND EXPORTING G-CODE
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
