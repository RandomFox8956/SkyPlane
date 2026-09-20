"""Blender source for the portable Sky Plane cockpit. Run in Blender's Python API."""
import bpy, math, json
from pathlib import Path
from mathutils import Vector

OUT = Path(__file__).resolve().parent
scene = bpy.data.scenes.new('SkyPlane Cockpit')
bpy.context.window.scene = scene
materials = {}
def material(name, color):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    materials[name] = m
    return m
shell = material('Graphite powder coat', (.19,.23,.24))
rubber = material('Soft black trim', (.045,.06,.067))
metal = material('Brushed aluminium', (.46,.53,.54))
ivory = material('Warm interior trim', (.65,.66,.59))
red = material('Mixture red', (.65,.14,.09))
liner = material('Light grey cabin lining', (.55,.59,.58))
fabric = material('Blue grey seat upholstery', (.28,.39,.44))
cushion = material('Seat centre cushions', (.44,.52,.54))
glass = material('Blue tinted window glass', (.62,.84,.88))
glass.diffuse_color=(.62,.84,.88,.065)
amber = material('Amber indicator lamps', (.95,.58,.16))
green = material('Green indicator lamps', (.34,.72,.53))
seam = material('Upholstery stitching', (.62,.68,.66))
labels=[]
def point(p): return (p[0],-p[2],p[1])
def cube(name, pos, size, mat, bevel=.015):
    bpy.ops.mesh.primitive_cube_add(size=1, location=point(pos))
    o=bpy.context.object; o.name=name; o.dimensions=(size[0],size[2],size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mat)
    if bevel:
        mod=o.modifiers.new('Soft machined edges','BEVEL'); mod.width=bevel; mod.segments=3 if bevel>=.035 else 1
    return o
def beam(name,a,b,width,mat):
    aa,bb=Vector(point(a)),Vector(point(b))
    o=cube(name,((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2),(width,(bb-aa).length,width),mat,.008)
    o.rotation_euler=(bb-aa).to_track_quat('Z','Y').to_euler()
    return o
def disc(name,x,y,z,r,depth,mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=12 if r<.05 else 32, radius=r, depth=depth, location=point((x,y,z)), rotation=(math.pi/2,0,0))
    o=bpy.context.object; o.name=name; o.data.materials.append(mat); return o
def surface(name, corners, mat, divisions=1):
    # Small panels keep the lightweight painter renderer stable when looking along walls.
    a,b,c,d=[Vector(p) for p in corners]; verts=[]; faces=[]
    for j in range(divisions+1):
        for i in range(divisions+1):
            u=i/divisions;v=j/divisions
            verts.append(point(a*(1-u)*(1-v)+b*u*(1-v)+c*u*v+d*(1-u)*v))
    for j in range(divisions):
        for i in range(divisions):
            k=j*(divisions+1)+i;faces.append((k,k+1,k+divisions+2,k+divisions+1))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.materials.append(mat)
    o=bpy.data.objects.new(name,mesh);scene.collection.objects.link(o);o['two_sided']=True
    if mat in (liner,shell):
        # Real panel thickness keeps adjacent curved panels sealed at tessellation joins.
        skin=o.modifiers.new('Cabin panel thickness','SOLIDIFY');skin.thickness=.05;skin.offset=0
        o['two_sided']=False
    return o
def label(text, pos, width, right=(1,0,0), up=(0,1,0), height=.035):
    p=Vector(pos);r=Vector(right)*width/2;u=Vector(up)*height/2
    labels.append(dict(v=[list(p-r+u),list(p+r+u),list(p+r-u),list(p-r-u)],c='#18262a',t=text,tc='#d7e0d5',d=0))
    # Retain editable lettering in the Blender source; runtime uses crisp canvas text.
    curve=bpy.data.curves.new(text,'FONT');curve.body=text;curve.align_x='CENTER';curve.align_y='CENTER';curve.size=height*.76
    ob=bpy.data.objects.new('Placard '+text,curve);scene.collection.objects.link(ob);ob.location=point(pos)
    rr=Vector(point(right));uu=Vector(point(up));normal=rr.cross(uu)
    from mathutils import Matrix
    ob.rotation_euler=Matrix((rr,uu,normal)).transposed().to_euler();curve.materials.append(ivory)

cube('Sculpted instrument panel',(0,.83,-2.17),(2.65,.87,.19),shell,.09)
surface('Sealed cabin floor',[(-1.42,0,-2.27),(1.42,0,-2.27),(1.42,0,1.85),(-1.42,0,1.85)],shell,10)
cube('Forward footwell',(0,.19,-2.24),(2.64,.48,.10),shell,.02)
surface('Front pressure bulkhead',[(-1.42,0,-2.27),(1.42,0,-2.27),(1.31,1.36,-2.16),(-1.31,1.36,-2.16)],shell,6)
cube('Padded glareshield',(0,1.31,-2.17),(2.78,.10,.48),rubber,.045)
cube('Glareshield highlight',(0,1.268,-1.942),(2.59,.016,.018),metal,.005)
for side in [-1,1]:
    # Each glazed opening is bounded on all four sides by opaque trim.
    front=[(side*.045,1.36,-2.16),(side*1.31,1.36,-2.16),(side*1.14,2.27,-1.83),(side*.045,2.27,-1.83)]
    surface('Laminated front windshield',front,glass)
    for i in range(4):beam('Windscreen gasket',front[i],front[(i+1)%4],.055,rubber)
    beam('Swept windscreen pillar',(side*1.31,1.28,-2.16),(side*1.14,2.32,-1.83),.085,liner)
    # Only the forward side is glazed; the shoulder and seat area is solid cabin lining.
    pane=[(side*1.36,1.05,-1.95),(side*1.42,1.05,-.45),(side*1.42,2.23,-.45),(side*1.17,2.27,-1.77)]
    surface('Side window glass',pane,glass,8)
    for i in range(4):beam('Side window frame',pane[i],pane[(i+1)%4],.09,liner)
    surface('Front corner glazing',[front[1],pane[0],pane[3],front[2]],glass)
    # Shell panels meet the exact same boundary vertices as the glazing and floor.
    surface('Lower window corner',[(side*1.42,0,-2.27),(side*1.42,0,-1.95),pane[0],front[1]],liner,3)
    surface('Lower cabin wall',[(side*1.42,0,-1.95),(side*1.42,0,-.45),pane[1],pane[0]],liner,8)
    surface('Lower aft cabin wall',[(side*1.42,0,-.45),(side*1.42,0,1.85),(side*1.42,1.05,1.85),pane[1]],liner,8)
    surface('Aft sidewall',[pane[1],(side*1.42,1.05,1.85),(side*1.42,2.23,1.85),pane[2]],liner,10)
    surface('Curved roof shoulder',[pane[3],pane[2],(side*1.42,2.23,1.85),(side*1.08,2.48,1.85)],liner,6)
    surface('Front roof corner',[front[2],pane[3],(side*1.08,2.48,1.85),(side*1.14,2.27,-1.83)],liner,4)
    cube('Padded side arm ledge',(side*1.34,.98,-.45),(.16,.075,2.65),shell,.025)
    cube('Window latch',(side*1.30,1.13,-.70),(.07,.04,.18),metal,.01)
    cube('Sidewall storage pocket',(side*1.32,.56,.65),(.13,.28,.42),rubber,.025)
surface('Ceiling',[(-1.14,2.27,-1.83),(1.14,2.27,-1.83),(1.08,2.48,1.85),(-1.08,2.48,1.85)],liner,9)
surface('Back wall',[(-1.42,0,1.85),(1.42,0,1.85),(1.42,2.48,1.85),(-1.42,2.48,1.85)],liner,8)
cube('Rear door frame',(0,1.08,1.80),(.77,2.16,.10),rubber,.025)
cube('Rear cabin door',(0,1.07,1.735),(.68,2.04,.045),shell,.025)
cube('Door inset',(0,1.42,1.702),(.43,.52,.02),rubber,.02)
cube('Door handle',(.24,1.03,1.65),(.035,.035,.14),metal,.008)
beam('Centre windshield pillar',(0,1.32,-2.17),(0,2.30,-1.83),.075,liner)
beam('Upper windshield header',(-1.17,2.28,-1.83),(1.17,2.28,-1.83),.12,liner)
# A simple overhead panel borrows the reference's layout without hundreds of switches.
cube('Overhead console',(0,2.28,-.88),(.73,.10,1.18),shell,.03)
for row in range(3):
    for col in range(4):
        cube('Overhead switch',(col*.145-.217,2.213,-1.22+row*.29),(.06,.025,.09),ivory if row!=2 else rubber,.008)
for side in [-1,1]:
    cube('Sun visor',(side*.69,2.17,-1.66),(.67,.035,.25),rubber,.025)
    x=side*.66
    cube('Seat mounting base',(x,.20,.63),(.47,.36,.53),rubber,.035)
    for dx in [-.24,.24]:cube('Seat track',(x+dx,.055,.59),(.05,.045,.94),metal,.005)
    cube('Pilot seat cushion' if side<0 else 'Copilot seat cushion',(x,.45,.58),(.68,.17,.71),fabric,.065)
    cube('Seat cushion insert',(x,.545,.55),(.49,.035,.49),cushion,.014)
    back=cube('Pilot seat back' if side<0 else 'Copilot seat back',(x,1.00,.99),(.66,.91,.17),fabric,.06)
    back.rotation_euler.x=math.radians(-7)
    cube('Seat back padding',(x,1.02,.878),(.48,.65,.085),cushion,.035)
    cube('Headrest',(x,1.57,1.025),(.44,.27,.19),fabric,.045)
    for dx in [-.38,.38]:
        cube('Seat armrest',(x+dx,.77,.57),(.09,.085,.51),rubber,.025)
        beam('Armrest support',(x+dx,.43,.77),(x+dx,.74,.77),.04,metal)
    cube('Lap belt',(x,.575,.60),(.55,.025,.075),rubber,.003)
    cube('Seat belt buckle',(x,.595,.60),(.07,.027,.09),metal,.006)
for x in [-.69,-.18,.33]:
    disc('Instrument metal rim',x,1.02,-2.048,.225,.022,metal)
    disc('Instrument black bezel',x,1.02,-2.027,.21,.028,rubber)
    for dx in [-.18,.18]:
        for dy in [-.18,.18]: disc('Bezel screw',x+dx,1.02+dy,-2.005,.012,.012,metal)
cube('Avionics surround',(.93,.985,-2.035),(.46,.43,.065),rubber,.025)
cube('Radio glass',(.93,1.05,-1.992),(.39,.18,.016),rubber,.006)
for x in [.78,1.08]:disc('Radio tuning knob',x,.86,-1.974,.035,.065,metal)
cube('Switch rail',(-.20,.64,-2.024),(1.76,.14,.04),rubber,.014)
for i in range(7):
    x=-.92+i*.20
    disc('Switch socket',x,.64,-1.989,.029,.019,metal)
    beam('Toggle switch',(x,.64,-1.98),(x,.68,-1.935),.017,ivory)
cube('Centre pedestal',(0,.29,-.65),(.34,.50,2.04),shell,.035)
cube('Console top',(0,.55,-.53),(.31,.035,1.74),rubber,.01)
for x,mat in [(-.09,rubber),(.10,red)]:
    beam('Engine control stem',(x,.52,-1.28),(x,.70,-1.17),.026,metal)
    cube('Engine control grip',(x,.72,-1.16),(.12,.075,.12),mat,.023)
for x in [-.66,.66]:
    beam('Yoke column',(x,.35,-1.96),(x,.60,-1.13),.065,metal)
    cube('Yoke hub',(x,.62,-1.12),(.15,.13,.12),rubber,.025)
    for side in [-1,1]:
        beam('Yoke wing',(x,.62,-1.12),(x+side*.24,.68,-1.10),.056,rubber)
        beam('Yoke grip',(x+side*.24,.68,-1.10),(x+side*.27,.84,-1.10),.066,rubber)
        cube('Rudder pedal',(x+side*.14,.16,-1.75),(.19,.08,.25),metal,.015)
for z in [-.75,-.48,-.21,.06]:
    for x in [-.085,.085]:cube('Console selector',(x,.59,z),(.065,.028,.075),metal,.009)

# Cabin detail pass: functional groupings, fasteners, upholstery and service fittings.
for x in [-.66,.66]:
    # Raised side bolsters, stitched channels and shoulder restraints.
    for dx in [-.26,.26]:
        cube('Seat back bolster',(x+dx,1.015,.835),(.10,.67,.10),fabric,.035)
        cube('Cushion edge piping',(x+dx,.558,.55),(.009,.009,.49),seam,.002)
    for y in [.80,.92,1.04,1.16,1.28]:
        cube('Upholstery seam',(x,y,.827),(.40,.006,.006),seam,0)
    for dx in [-.145,.145]:
        surface('Shoulder harness',[(x+dx-.026,1.34,.811),(x+dx+.026,1.34,.811),(x+dx+.037,.74,.79),(x+dx-.015,.74,.79)],rubber)
        cube('Harness adjuster',(x+dx,.93,.795),(.071,.050,.020),metal,.004)
    cube('Headrest inset',(x,1.57,.921),(.30,.14,.026),cushion,.012)
    label('SKYPLANE',(x,1.57,.904),.235,right=(-1,0,0),height=.026)
    cube('Seat adjustment lever',(x+.28,.31,.33),(.11,.025,.045),metal,.005)
    surface('Anti-slip floor mat',[(x-.33,.024,-1.31),(x+.33,.024,-1.31),(x+.33,.024,-.27),(x-.33,.024,-.27)],rubber,6)
    for z in [-1.18,-1.06,-.94,-.82,-.70,-.58,-.46]:cube('Floor mat rib',(x,.028,z),(.56,.008,.012),shell,0)
    for side in [-1,1]:
        for z in [-1.82,-1.76,-1.70]:cube('Pedal tread',(x+side*.14,.204,z),(.15,.012,.012),rubber,0)
        for y in [.73,.765,.80]:cube('Yoke grip rib',(x+side*.26,y,-1.059),(.054,.009,.006),shell,0)
    disc('Yoke transmit button',x-.265,.834,-1.060,.017,.009,red)
    label('SP',(x,.623,-1.052),.080,height=.037)
    # Parked wiper stays below the main sightline.
    beam('Windshield wiper arm',(x-.18,1.37,-2.12),(x+.12,1.44,-2.088),.016,metal)
    beam('Windshield wiper blade',(x-.04,1.465,-2.079),(x+.36,1.465,-2.079),.019,rubber)
    cube('Demister vent',(x,1.365,-2.21),(.50,.011,.085),shell,.006)
    for dx in [-.18,-.12,-.06,0,.06,.12,.18]:cube('Demister slot',(x+dx,1.373,-2.21),(.026,.004,.059),rubber,0)

# Individual overhead modules, lamp lenses and rotary/toggle controls.
for z,title in [(-1.22,'ELECTRICAL'),(-.93,'LIGHTS'),(-.64,'CABIN AIR')]:
    cube('Overhead module',(0,2.217,z),(.64,.017,.254),rubber,.01)
    label(title,(0,2.202,z-.086),.40,right=(1,0,0),up=(0,0,1),height=.034)
    for x in [-.24,-.08,.08,.24]:
        cube('Overhead toggle mount',(x,2.20,z+.019),(.058,.023,.06),metal,.004)
        beam('Overhead toggle',(x,2.19,z+.019),(x,2.145,z+.038),.013,ivory)
        cube('Overhead status light',(x,2.201,z+.086),(.035,.006,.012),green if title!='CABIN AIR' else amber,.002)
    for x in [-.29,.29]:
        for dz in [-.103,.103]:cube('Overhead captive screw',(x,2.204,z+dz),(.017,.006,.017),metal,.004)
for side in [-1,1]:
    x=side*.80
    cube('Ceiling lamp housing',(x,2.303,-.60),(.23,.054,.35),shell,.022)
    cube('Ceiling lamp diffuser',(x,2.270,-.60),(.17,.011,.25),ivory,.009)
    # Small vent grilles in the side lining, below each window.
    cube('Side air outlet surround',(side*1.395,.79,-1.32),(.036,.20,.30),shell,.012)
    for y in [.73,.77,.81,.85]:cube('Side air outlet slat',(side*1.369,y,-1.32),(.018,.011,.25),rubber,0)
    for z in [-1.65,-.9,.0,.43]:
        cube('Window trim fastener',(side*1.326,1.02,z),(.020,.017,.017),metal,.004)
    beam('Cabin grab handle',(side*1.29,1.64,.64),(side*1.29,1.97,.64),.036,metal)
    for y in [1.64,1.97]:beam('Handle standoff',(side*1.29,y,.64),(side*1.40,y,.64),.025,shell)
    label('WINDOW LOCK',(side*1.315,1.17,-.70),.26,right=(0,0,side),height=.026)

# Labelled lower switch bank and panel service screws.
for i,title in enumerate(['BATT','ALT','AVIONICS','PITOT','BEACON','NAV','LAND']):
    label(title,(-.92+i*.20,.716,-1.987),.14,height=.028)
for x in [-1.20,-.96,.61,1.20]:
    for y in [.47,1.20]:disc('Panel retaining screw',x,y,-2.052,.012,.013,metal)
label('SKYPLANE  /  FLIGHT DECK',(-.18,.445,-2.054),.68,height=.03)
cube('Caution annunciator frame',(.91,.64,-2.014),(.39,.17,.042),rubber,.008)
for x,title,mat in [(.81,'FIRE',red),(1.0,'WARN',amber)]:
    cube('Guarded annunciator',(x,.66,-1.988),(.15,.069,.012),mat,.007)
    label(title,(x,.661,-1.979),.115,height=.025)
label('ANNUNCIATORS',(.91,.585,-1.984),.30,height=.025)

# Console inset radio, trim wheel and marked throttle quadrant.
cube('Console radio bezel',(0,.59,-.74),(.28,.036,.31),metal,.012)
cube('Console radio display',(0,.612,-.80),(.23,.012,.11),rubber,.004)
label('COM  118.20',(0,.621,-.80),.21,right=(1,0,0),up=(0,0,-1),height=.041)
for x in [-.092,.092]:
    o=disc('Console tuning dial',x,.625,-.65,.031,.024,rubber);o.rotation_euler=(0,0,0)
label('THROTTLE',(-.09,.578,-1.46),.13,right=(1,0,0),up=(0,0,-1),height=.025)
label('MIXTURE',(.10,.578,-1.46),.13,right=(1,0,0),up=(0,0,-1),height=.025)
for x in [-.09,.10]:
    cube('Throttle lever slot',(x,.58,-1.23),(.021,.015,.30),rubber,.003)
    for z in [-1.35,-1.29,-1.23,-1.17,-1.11]:cube('Throttle detent marking',(x+.035,.59,z),(.025,.004,.008),ivory,0)
wheel=disc('Elevator trim wheel',.205,.39,-.35,.13,.045,rubber);wheel.rotation_euler=(0,math.pi/2,0)
for i in range(12):
    a=i*math.pi/6
    cube('Trim wheel grip',(.205,.39+math.sin(a)*.125,-.35+math.cos(a)*.125),(.055,.022,.022),metal,.004)
label('TRIM',(0,.58,-.34),.16,right=(1,0,0),up=(0,0,-1),height=.029)
label('PARK BRAKE',(0,.58,.21),.23,right=(1,0,0),up=(0,0,-1),height=.026)
cube('Parking brake pull handle',(0,.64,.30),(.14,.038,.045),red,.009)

# Aft service details visible during a full turn.
label('FLIGHT DECK',(0,1.91,1.706),.43,right=(-1,0,0),height=.045)
label('KEEP CLEAR',(0,.55,1.706),.35,right=(-1,0,0),height=.035)
cube('Rear equipment cabinet',(.99,.73,1.68),(.60,1.10,.24),shell,.035)
label('EMERGENCY EQUIPMENT',(.99,1.12,1.548),.48,right=(-1,0,0),height=.035)
for x in [.76,1.22]:
    for y in [.26,1.20]:disc('Equipment cabinet latch',x,y,1.545,.018,.017,metal)
cube('Cabinet vent',(.99,.91,1.546),(.43,.20,.02),rubber,.009)
for y in [.84,.88,.92,.96]:cube('Cabinet vent grille',(.99,y,1.529),(.39,.009,.008),metal,0)
o=disc('Fire extinguisher',-.99,.43,1.52,.095,.40,red);o.rotation_euler=(0,0,0)
cube('Extinguisher retaining strap',(-.99,.46,1.413),(.19,.043,.018),rubber,.004)
cube('Extinguisher handle',(-.99,.67,1.52),(.13,.035,.08),rubber,.008)
label('FIRE',(-.99,.43,1.419),.12,right=(-1,0,0),height=.04)
label('EXIT',(0,2.21,1.78),.26,right=(-1,0,0),height=.055)

# Export evaluated Blender geometry into the game's offline polygon format.
# Shared deformation gives the complete enclosure a barrel section, including its
# window boundaries and attached trim. The instrument panel stays in its original plane.
def rounded_cabin(p):
    x,y,z=p
    t=max(0,min(1,(z+1.95)/1.20)); t=t*t*(3-2*t)
    height=max(0,min(1,y/2.48))
    x2=x*(1-t*.12*(1-math.sin(math.pi*height)))
    y2=y-t*.52*(abs(x)/1.42)**2.2*max(0,min(1,(y-1.0)/1.48))
    return Vector((x2,y2,z))

# Bake the same shape into the editable Blender model and the game export.
for ob in list(scene.objects):
    if ob.type!='MESH': continue
    bpy.context.view_layer.objects.active=ob
    for mod in list(ob.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
    inv=ob.matrix_world.inverted()
    for v in ob.data.vertices:
        p=ob.matrix_world @ v.co
        q=rounded_cabin((p.x,p.z,-p.y))
        v.co=inv @ Vector(point(q))
    ob.data.update()
for item in labels:
    item['v']=[list(rounded_cabin(p)) for p in item['v']]
for ob in scene.objects:
    if ob.type=='FONT':
        p=ob.location; ob.location=point(rounded_cabin((p.x,p.z,-p.y)))
bpy.context.view_layer.update()
shell_panels={'Sealed cabin floor','Front pressure bulkhead','Lower cabin wall','Lower aft cabin wall','Aft sidewall','Curved roof shoulder','Front roof corner','Ceiling','Back wall','Lower window corner','Laminated front windshield','Side window glass','Front corner glazing'}
base_panels={'Anti-slip floor mat','Overhead console'}
deps=bpy.context.evaluated_depsgraph_get(); faces=[]
for ob in scene.objects:
    if ob.type!='MESH': continue
    ev=ob.evaluated_get(deps); mesh=ev.to_mesh()
    for poly in mesh.polygons:
        vertices=[]
        for i in poly.vertices:
            p=ob.matrix_world @ mesh.vertices[i].co
            vertices.append([round(p.x,5),round(p.z,5),round(-p.y,5)])
        color=ob.data.materials[0].diffuse_color
        normal=ob.matrix_world.to_3x3() @ poly.normal
        light=.77+.23*max(0,normal.dot(Vector((-.35,-.6,.72)).normalized()))
        hexcolor='#'+''.join(f'{round(min(1,c*light)*255):02x}' for c in color[:3])
        data=dict(v=vertices,c=hexcolor,d=0,cull=not ob.get('two_sided',False))
        name=ob.name.split('.')[0]
        data['layer']=-3 if name in shell_panels else -2 if name in base_panels else -1 if name=='Overhead module' else 0
        if color[3]<1: data['a']=round(color[3],3)
        faces.append(data)
    ev.to_mesh_clear()
faces.extend(labels)
(OUT/'cockpit.js').write_text('/* Generated by build_cockpit.py in Blender. */\nwindow.SkyCockpit='+json.dumps({'faces':faces},separators=(',',':'))+';\n')
# Save an editable scene, framed from the pilot's seat.
bpy.ops.object.camera_add(location=point((-.60,1.65,.28)))
cam=bpy.context.object;cam.name='Pilot eye';cam.rotation_euler=(Vector(point((-.60,1.30,-2.1)))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=25;scene.camera=cam
scene.render.resolution_x=1440;scene.render.resolution_y=900;scene.render.resolution_percentage=100
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_perspective='CAMERA'
        area.spaces.active.shading.color_type='MATERIAL'
save_versions=bpy.context.preferences.filepaths.save_version
bpy.context.preferences.filepaths.save_version=0
try: bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'skyplane-cockpit.blend'))
finally: bpy.context.preferences.filepaths.save_version=save_versions
print('EXPORTED',len(faces),'faces')
