"""Rebuild Sky Plane's terminal, airfield furniture and aircraft in Blender.
Run with runpy.run_path('C:/SkyPlane/build_airport.py', run_name='__main__').
Exports a flat, offline mesh bundle and an editable .blend; no downloaded assets.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
OUT=Path(__file__).resolve().parent
previous=[s for s in bpy.data.scenes if s.name.startswith('SkyPlane / Coastal aviation centre')]
scene=bpy.data.scenes.new('SkyPlane / Coastal aviation centre')
bpy.context.window.scene=scene
for old_scene in previous:
    for ob in list(old_scene.objects):bpy.data.objects.remove(ob,do_unlink=True)
    for col in list(old_scene.collection.children):bpy.data.collections.remove(col)
    bpy.data.scenes.remove(old_scene)
scene.name='SkyPlane / Coastal aviation centre'
groups={}; current=None; colliders=[]; signs=[]
def group(name):
    global current
    current=bpy.data.collections.new(name);scene.collection.children.link(current);groups[name]=current
def move(o):
    for c in list(o.users_collection):c.objects.unlink(o)
    current.objects.link(o);return o
def point(p):return (p[0],-p[2],p[1])
def mat(name,hex,metal=0,rough=.5,alpha=1):
    rgb=tuple(int(hex[i:i+2],16)/255 for i in (1,3,5));m=bpy.data.materials.new(name);m.diffuse_color=(*rgb,alpha);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*rgb,1);bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough;bs.inputs['Alpha'].default_value=alpha
    return m
stone=mat('Honed limestone','#d4ccb9',rough=.78);floor=mat('Warm terrazzo','#ccc7b8',rough=.68)
white=mat('Ceramic white','#edf0e8',rough=.3);metal=mat('Brushed anodised aluminium','#a0afb2',.65,.27)
dark=mat('Midnight graphite','#233442',.3,.4);wood=mat('Honey oak','#b79060',rough=.62)
glass=mat('Laminated blue glazing','#8cbdcd',.25,.14,.26);blue=mat('Midnight blue upholstery','#285d70',rough=.85)
teal=mat('Deep teal livery','#226d77',.35,.29);gold=mat('Champagne metal','#d6b676',.65,.3)
rubber=mat('Rubber and seals','#202a31',rough=.8);green=mat('Plant leaves','#477657',rough=.9)
light=mat('Warm diffused light','#fff1cb',rough=.25);red=mat('Safety red','#cf5445',rough=.45)
def cube(name,pos,size,m,bevel=0,solid=False,gear=False):
    bpy.ops.mesh.primitive_cube_add(size=1,location=point(pos));o=move(bpy.context.object);o.name=name;o.dimensions=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
    if bevel:
        b=o.modifiers.new('Manufactured edge radius','BEVEL');b.width=bevel;b.segments=2
        n=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
    if solid:colliders.append(dict(x=pos[0],y=pos[1]-size[1]/2,z=pos[2],w=size[0],h=size[1],d=size[2],c='#'+''.join(f'{round(c*255):02x}' for c in m.diffuse_color[:3]),solid=True))
    if gear:o['gear']=True
    return o
def mesh(name,vertices,faces,m,smooth=False):
    data=bpy.data.meshes.new(name);data.from_pydata([point(p) for p in vertices],[],faces);data.update();o=bpy.data.objects.new(name,data);current.objects.link(o);data.materials.append(m)
    for p in data.polygons:p.use_smooth=smooth
    return o
def beam(name,a,b,r,m,verts=10):
    aa,bb=Vector(point(a)),Vector(point(b));bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=(bb-aa).length,location=(aa+bb)/2);o=move(bpy.context.object);o.name=name;o.rotation_euler=(bb-aa).to_track_quat('Z','Y').to_euler();o.data.materials.append(m)
    for p in o.data.polygons:p.use_smooth=len(p.vertices)==4
    return o
def sign(text,x,y,z,w):
    signs.append(dict(v=[[x-w/2,y+1,z],[x+w/2,y+1,z],[x+w/2,y-1,z],[x-w/2,y-1,z]],c='#182d39',t=text,tc='#f4e9ca'))
    cube('Wayfinding / '+text,(x,y,z-.1),(w,2,.18),dark,.08)
    bpy.ops.object.text_add(location=point((x,y-.4,z+.03)),rotation=(math.pi/2,0,0));o=move(bpy.context.object);o.name=text;o.data.body=text;o.data.align_x='CENTER';o.data.size=min(.8,w/max(1,len(text)))*1.3;o.data.extrude=.001;o.data.materials.append(white)
def pane(x,z,w,d):
    cube('Insulated glazing',(x,7.2,z),(w,9.4,d),glass,solid=True)
    cube('Stone sill',(x,2.55,z),(w,1.1,max(d,.45)),stone,solid=True)
def seat(x,z):
    cube('Seat / stitched blue cushion',(x,2.7,z),(1.65,.26,1.65),blue,.12,True)
    cube('Seat / curved back',(x,3.3,z+.72),(1.65,1.35,.22),blue,.13,True)
    for dx in [-.74,.74]:
        beam('Seat leg',(x+dx,2,z),(x+dx,2.6,z),.08,metal)
        cube('Armrest',(x+dx,3.05,z),(.13,.16,1.55),dark,.05)
def desk(x,z,w=10):
    cube('Oak desk carcass',(x,2.66,z),(w,1.32,3.5),wood,.08,True)
    cube('Stone counter',(x,3.38,z),(w+.25,.18,3.8),stone,.08)
    for dx in range(-int(w/2)+1,int(w/2),1):cube('Fluted desk front',(x+dx,2.67,z+1.79),(.065,1.2,.08),gold)
    cube('Monitor stem',(x,3.66,z-.5),(.13,.5,.13),metal)
    cube('Monitor',(x,4.05,z-.5),(1.8,.98,.1),dark,.05)
    cube('Monitor display',(x,4.05,z-.435),(1.6,.8,.015),teal)
    cube('Keyboard',(x,3.51,z+.5),(1.4,.08,.45),rubber,.03)
    for k in range(3):cube('Document tray',(x+2.5,3.48+k*.12,z+.2),(1.3,.06,.85),white,.02)
def planter(x,z):
    cube('Planter',(x,2.7,z),(2.7,1.4,2.7),stone,.2,True)
    for i in range(7):
        a=i*math.tau/7;beam('Palm stem',(x,3.2,z),(x+math.cos(a)*.6,5.7+i%2*.4,z+math.sin(a)*.6),.045,wood,6)
        mesh('Palm leaves',[(x,5.2,z),(x+math.cos(a+.3)*2.4,5.1,z+math.sin(a+.3)*2.4),(x+math.cos(a)*2.9,4.5,z+math.sin(a)*2.9),(x+math.cos(a-.3)*2.4,5.1,z+math.sin(a-.3)*2.4)],[(0,1,2,3)],green)
group('terminal')
cube('Continuous terrazzo floor',(384,1.9,-35),(94,.2,264),floor)
cube('Central concourse carpet',(384,2.015,-35),(13,.025,251),blue)
for x in range(340,432,6):
    if not 377<x<391:cube('Terrazzo joint',(x,2.024,-35),(.025,.012,260),stone)
for z in range(-164,97,6):
    for x in [357.75,410.25]:cube('Terrazzo joint',(x,2.024,z),(39.5,.012,.025),stone)
# Vaulted roof and exposed ribs. The centre strip is a continuous skylight.
for i in range(18):
    x0=335+i*5.5;x1=x0+5.5;h0=13+5*math.sin(i/18*math.pi);h1=13+5*math.sin((i+1)/18*math.pi)
    mesh('Curved roof panel',[(x0,h0,-170),(x1,h1,-170),(x1,h1,101),(x0,h0,101),(x0,h0+.4,-170),(x1,h1+.4,-170),(x1,h1+.4,101),(x0,h0+.4,101)],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2)],glass if 8<=i<=9 else white)
for z in range(-165,101,22):
    for i in range(12):
        x0=337+i*7.8;x1=x0+7.8;beam('Arched steel roof rib',(x0,12.65+4.9*math.sin(i/12*math.pi),z),(x1,12.65+4.9*math.sin((i+1)/12*math.pi),z),.14,metal)
    for x in [338,431]:
        beam('Column',(x,2,z),(x,13,z),.24,metal,16);colliders.append(dict(x=x,y=2,z=z,w=.6,h=11,d=.6,c='#a0afb2',solid=True))
    cube('Suspended linear light',(385,10,z),(15,.12,.3),light,.04)
for z in range(-155,92,22):
    pane(338,z,.18,21.7)
    if not 35<z<85:pane(431,z,.18,21.7)
cube('North stone wall',(384,8,-167),(94,12,.7),stone,.1,True)
for x,w in [(350,24),(405,52)]:cube('South wall',(x,8,97),(w,12,.7),stone,.1,True)
cube('Entrance paving',(453,1.92,62),(43,.16,51),stone,.1)
for i in range(10):cube('Entrance canopy fins',(448,11+i*.045,40+i*5),(37,.3,.55),wood,.08)
for z in [39,86]:beam('Entrance canopy column',(466,2,z),(466,11,z),.24,metal,16)
for z in [32,94]:planter(441,z)
# Check-in, baggage equipment and queue rails.
for z in [29,47,65]:
    desk(417,z,10);sign('CHECK-IN  /  SKY PLANE',417,6,z-2.2,10)
cube('Baggage belt',(425,2.55,47),(2.6,1.1,57),rubber,.2,True)
for z in range(22,75,2):cube('Belt rib',(425,3.12,z),(2.5,.03,.04),metal)
for z in [27,45,63]:
    for x in [399,405]:beam('Queue stanchion',(x,2,z),(x,3.1,z),.06,metal,8)
    beam('Queue rope',(399,3,z),(405,3,z),.025,dark,6)
for z in [58,72]:
    cube('Self service kiosk',(349,2.7,z),(1.4,1.4,1.4),white,.15,True);cube('Kiosk display',(349,3.8,z),(1.3,1.1,.15),dark,.08)
# Security has a real walk-through arch, scanner tunnel and roller conveyor.
for x in [364,408]:
    cube('X-ray scanner',(x,3.4,-15),(8,2.8,6),dark,.35,True)
    cube('Scanner aperture',(x,3.3,-11.95),(5,1.5,.06),rubber,.3)
    cube('Conveyor base',(x,2.55,-9),(7,1.1,10),metal,.15,True)
    for z in range(-13,-4):beam('Conveyor roller',(x-3,3.16,z),(x+3,3.16,z),.14,rubber,10)
for x in [377,393]:cube('Security arch post',(x,4.2,-18),(.65,4.4,.7),white,.15,True)
cube('Security arch header',(385,6.45,-18),(16.6,.8,.7),white,.15)
for x in [377,393]:cube('Security status light',(x,5.4,-17.6),(.18,.5,.04),teal,.04)
# Gate seating and cafe furniture.
for z in [-42,-64,-104,-130]:
    for base in [348,367]:
        beam('Bench support rail',(base-1,2.4,z),(base+9,2.4,z),.11,metal)
        for i in range(5):seat(base+i*2,z)
desk(350,-85,11);sign('A2  /  DEPARTURES',350,7,-87,15)
desk(353,3,20);sign('COAST COFFEE',353,6,.5,12)
for z in [15,31]:
    beam('Cafe table pedestal',(354,2,z),(354,3.1,z),.2,metal)
    cube('Cafe tabletop',(354,3.15,z),(4,.18,4),wood,.3,True)
    seat(350.7,z);seat(357.3,z)
for z in [-150,-95,-30,15,85]:planter(341,z)
# Staff rooms: open doorways, glazed partitions, workstation furniture.
for z,d in [(-157,18),(-110,22),(-64,17)]:
    cube('Office partition',(394,3,z),(.45,2,d),wood,.03,True);cube('Office glazing',(394,6.5,z),(.18,5,d),glass,solid=True)
cube('Office separating wall',(412,5.5,-110),(37,7,.4),stone,.06,True)
for z in [-91,-134]:desk(419,z,11);seat(419,z-5)
sign('FLIGHT OPERATIONS',414,7,-70,27);sign('AIRPORT MANAGEMENT',413,7,-116,29)
cube('Washroom wall',(415,5,10),(32,6,.4),stone,.05,True);cube('Washroom side',(399,5,1),(.4,6,17),stone,.05,True)
for x in [407,416,425]:cube('Washbasin',(x,2.65,1),(3,1.3,2),white,.35,True)
sign('WASHROOMS',415,5.5,11,13)
sign('SECURITY   /   DEPARTURES',384,8,20,50);sign('GATES  A2 — A3',384,8,-23,38)
sign('SKY PLANE  /  COASTAL TERMINAL',384,11,98,72)
# Covered maintenance workshop and airside ground-service station.
cube('Service court',(368,1.9,157),(64,.2,116),stone)
for x in [339,395]:cube('Workshop wall',(x,6,156),(.5,8,76),stone,.1,True)
cube('Workshop rear',(367,6,194),(56,8,.5),stone,.1,True)
cube('Workshop roof',(367,10.1,156),(62,.5,81),dark,.1)
desk(384,165,12)
for z in [147,154,176,183]:
    cube('Tool drawer cabinet',(388,2.8,z),(6,1.6,4),teal,.1,True)
    for y in [2.4,2.8,3.2]:cube('Drawer handle',(384.92,y,z),(.08,.08,2.8),metal,.02)
sign('ENGINEERING  /  MAINTENANCE',367,8,119,45)
desk(329,220,6);sign('A1 / GROUND SERVICES',319,6,232,28)
for z in [204,214]:
    cube('Baggage cart platform',(348,2.6,z),(7,.4,3.6),metal,.1,True)
    for dx in [-2.5,2.5]:
        for dz in [-1.1,1.1]:beam('Baggage cart wheel',(348+dx-.15,2.3,z+dz),(348+dx+.15,2.3,z+dz),.3,rubber,12)
    for dx in [-1.8,0,1.8]:cube('Luggage',(348+dx,3.45,z),(1.4,1.4,1.1),blue if dx else gold,.18,True)
# Service props are exported separately for the purchased airfield buildings.
group('hangar')
for x in [-43,43]:cube('Hangar side',(x,16,0),(1,28,100),stone,.15)
cube('Hangar rear',(0,17,-50),(86,30,1),dark,.15)
for i in range(16):
    x=-44+i*5.5;nx=x+5.5;y=29+11*math.sin(i/16*math.pi);ny=29+11*math.sin((i+1)/16*math.pi)
    mesh('Curved hangar roof',[(x,y,-52),(nx,ny,-52),(nx,ny,52),(x,y,52)],[(0,1,2,3)],metal)
cube('Hangar floor',(0,2,0),(89,.12,104),stone)
for z in [-45,-20,5,30,50]:beam('Hangar roof truss',(-42,28,z),(42,28,z),.28,metal)
group('tower')
beam('Control tower tapered shaft',(0,2,0),(0,108,0),10,stone,20)
for y,r in [(100,20),(108,23),(123,24)]:beam('Tower deck',(0,y,0),(0,y+2,0),r,dark,24)
for i in range(16):
    a=i*math.tau/16;b=(i+1)*math.tau/16;mesh('Control room glazing',[(math.cos(a)*20,110,math.sin(a)*20),(math.cos(b)*20,110,math.sin(b)*20),(math.cos(b)*22,123,math.sin(b)*22),(math.cos(a)*22,123,math.sin(a)*22)],[(0,1,2,3)],glass)
beam('Tower aerial',(0,125,0),(0,149,0),.35,metal)
group('fuel')
beam('Fuel tank',(0,8,-10),(0,8,10),7,white,24)
for z in [-7,7]:cube('Tank cradle',(0,3.5,z),(12,3,2),dark,.2)
cube('Pump station',(11,3.3,0),(3,2.6,3),teal,.2)
# Aircraft: smooth sectional fuselages, airfoil wings, engine fans and cockpit glazing.
def hull(name,stations,m):
    v=[];n=32
    for z,rx,ry,cy in stations:
        for i in range(n):a=i/n*math.tau;v.append((math.cos(a)*rx,cy+math.sin(a)*ry,z))
    faces=[]
    for j in range(len(stations)-1):
        for i in range(n):faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
    faces.extend([tuple(range(n-1,-1,-1)),tuple((len(stations)-1)*n+i for i in range(n))]);return mesh(name,v,faces,m,True)
def wing(name,side,span,z,y,chord,tip,m):
    v=[]
    for x,c,zz,yy in [(.65,chord,z,y),(span*.55,chord*.75,z+.4,y+.12),(span,tip,z+1.1,y+.32)]:
        for u,h in [(0,0),(.12,.12),(.4,.10),(1,0),(.45,-.035),(.1,-.035)]:v.append((side*x,yy+h,zz+c*u))
    fs=[]
    for j in range(2):
        for i in range(6):fs.append((j*6+i,j*6+(i+1)%6,(j+1)*6+(i+1)%6,(j+1)*6+i))
    fs.extend([(0,5,4,3,2,1),(12,13,14,15,16,17)]);mesh(name,v,fs,m)
def wheels():
    for x,z in [(-1.2,1),(1.2,1),(0,-3.6)]:
        o=beam('Landing gear oleo',(x,-.4,z),(x,-1.55,z),.08,metal);o['gear']=True
        o=beam('Tyre',(x-.15,-1.65,z),(x+.15,-1.65,z),.35,rubber,20);o['gear']=True
        o=beam('Wheel hub',(x-.16,-1.65,z),(x+.16,-1.65,z),.18,metal,16);o['gear']=True
for kind in ['trainer','jet','cargo','military']:
    group(kind);jet=kind=='jet';body=[(-6.8,.04,.05,.6),(-6.45,.4,.48,.6),(-5.8,.8,.85,.65),(-4.7,1.03,1.05,.65),(-2.5,1.08,1.08,.65),(0,1.08,1.08,.65),(3,1.02,1.02,.7),(4.8,.78,.85,.8),(6,.45,.58,.92),(7,.06,.12,1)] if jet else [(-5,.10,.16,.55),(-4.7,.45,.5,.55),(-3.7,.73,.73,.55),(-2.4,.86,.89,.62),(-1.1,.92,1.07,.7),(1,.87,.94,.65),(2.4,.65,.68,.6),(3.6,.4,.45,.7),(5.15,.07,.12,.9)]
    hull('Smooth pressurised fuselage',body,white if kind!='military' else metal)
    for side in [-1,1]:
        wing('Main airfoil wing',side,8.4 if jet else 7.8,-1.2,0 if jet else 1.13,3.1 if jet else 1.85,1.0,white)
        wing('Horizontal stabiliser',side,3.15,4.35 if jet else 3.6,1.0,1.5,.65,teal)
        if jet:
            cube('Winglet',(side*8.4,1.13,3.5),(.12,1.6,.6),teal,.04)
            for z in [-3.6+i*.58 for i in range(15)]:cube('Cabin window',(side*1.07,1.12,z),(.035,.32,.23),dark,.1)
            for x in [side*3.4]:
                beam('Turbofan nacelle',(x,-.62,-2),(x,-.62,.7),.74,white,28)
                beam('Engine inlet',(x,-.62,-2.035),(x,-.62,-2.06),.61,rubber,28)
                beam('Spinner',(x,-.62,-2.08),(x,-.62,-2.28),.17,metal,20)
                for k in range(18):
                    a=k/18*math.tau;b=a+.18;mesh('Fan blade',[(x+math.cos(a)*.18,-.62+math.sin(a)*.18,-2.085),(x+math.cos(b)*.59,-.62+math.sin(b)*.59,-2.085),(x+math.cos(b+.13)*.59,-.62+math.sin(b+.13)*.59,-2.085)],[(0,1,2)],metal)
        else:
            mesh('Cockpit side glazing',[(side*.81,1.1,-2.2),(side*.78,1.54,-1.45),(side*.82,1.54,-.35),(side*.89,1.02,-.15)],[(0,1,2,3)],dark)
            beam('Wing strut',(side*.65,-.05,.25),(side*4.8,1.35,1.25),.04,metal,8)
            for z in [.65,1.45]:cube('Cabin glazing',(side*.86,1.06,z),(.04,.4,.53),dark,.07)
        beam('Livery stripe',(side*.8,.5,-3),(side*.57,.53,3),.055,teal,6)
        cube('Door handle',(side*.91,.8,-.3),(.04,.04,.24),metal,.015)
        beam('Navigation light',(side*7.7,1.5,2.2),(side*7.7,1.52,2.2),.07,red if side<0 else teal,12)
    mesh('Swept vertical tail',[(-.08,.9,3.6),(.08,.9,3.6),(.08,4.45,5.6),(-.08,4.45,5.6),(-.08,4.35,6.3),(.08,4.35,6.3),(.08,.9,5.8),(-.08,.9,5.8)],[(0,3,4,7),(1,6,5,2),(0,1,2,3),(3,2,5,4),(4,5,6,7)],teal)
    mesh('Front windshield',[(-.7,1.15,-3.0),(.7,1.15,-3.0),(.65,1.62,-1.65),(-.65,1.62,-1.65)],[(0,1,2,3)],dark)
    beam('Windshield centre frame',(0,1.15,-3.02),(0,1.65,-1.64),.03,metal,8)
    if kind=='cargo':
        for side in [-1,1]:
            beam('Cargo turboprop pod',(side*3,.5,-2.4),(side*3,.5,-.2),.45,white,24)
            beam('Cargo propeller',(side*3-1.1,.5,-2.45),(side*3+1.1,.5,-2.45),.07,rubber,8)
    wheels()
# Rounded passenger character, shown walking through the concourse by the game.
group('person')
skin=mat('Passenger skin','#bf9c7d',rough=.8)
cube('Passenger jacket',(0,1.12,0),(.47,.65,.3),blue,.13)
cube('Passenger hips',(0,.76,0),(.35,.23,.26),dark,.1)
for side in [-1,1]:
    beam('Trouser leg',(side*.11,.71,0),(side*.13,.14,side*.08),.082,dark,10)
    cube('Shoe',(side*.13,.08,side*.08-.08),(.19,.14,.33),rubber,.06)
    beam('Jacket sleeve',(side*.23,1.35,0),(side*.31,.95,side*.10),.075,blue,10)
    beam('Hand',(side*.31,.95,side*.10),(side*.31,.80,side*.10),.052,skin,10)
beam('Neck',(0,1.41,0),(0,1.49,0),.075,skin,12)
bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=1,location=point((0,1.62,0)));o=move(bpy.context.object);o.name='Passenger head';o.scale=(.14,.13,.19);o.data.materials.append(skin)
for polygon in o.data.polygons:polygon.use_smooth=True
cube('Rolling suitcase',(.48,.32,.21),(.29,.56,.24),gold,.06)
beam('Suitcase handle',(.48,.6,.21),(.40,.88,.1),.018,metal,6)
# Export evaluated Blender geometry with smooth corner normals. Fonts use runtime sign textures.
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();assets={}
for name,col in groups.items():
    faces=[]
    for ob in col.objects:
        if ob.type!='MESH':continue
        ev=ob.evaluated_get(deps);me=ev.to_mesh();mat0=ob.data.materials[0];rgba=mat0.diffuse_color
        color='#'+''.join(f'{round(c*255):02x}' for c in rgba[:3]);normalmat=ob.matrix_world.to_3x3().inverted().transposed()
        for poly in me.polygons:
            vv=[];nn=[]
            for loopid in poly.loop_indices:
                loop=me.loops[loopid];v=ob.matrix_world@me.vertices[loop.vertex_index].co;n=normalmat@me.corner_normals[loopid].vector
                vv.append([round(v.x,4),round(v.z,4),round(-v.y,4)]);nn.append([round(n.x,4),round(n.z,4),round(-n.y,4)])
            f=dict(v=vv,n=nn,c=color,d=0)
            if rgba[3]<1:f['a']=round(rgba[3],3)
            if ob.get('gear'):f['gear']=True
            if mat0==teal:f['paint']=True
            faces.append(f)
        ev.to_mesh_clear()
    assets[name]=faces
assets['terminal'].extend(signs);assets['colliders']=colliders
(OUT/'airport-assets.js').write_text('/* Generated in Blender by build_airport.py. */\nglobalThis.SkyAssets='+json.dumps(assets,separators=(',',':'))+';\n',encoding='utf-8')
# Park the asset collections in a tidy editable Blender scene. Only the airport is visible initially.
for name,col in groups.items():
    if name!='terminal':col.hide_render=True;col.hide_viewport=True
bpy.ops.object.light_add(type='SUN',location=(0,0,120));sun=bpy.context.object;sun.rotation_euler=(.4,-.5,-.3);sun.data.energy=3
bpy.ops.object.camera_add(location=point((510,85,165)));cam=bpy.context.object;cam.rotation_euler=(Vector(point((384,6,-10)))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=28;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.world=bpy.data.worlds.new('Coastal daylight');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.53,.68,.8,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
scene.render.resolution_x=1440;scene.render.resolution_y=960;scene.render.resolution_percentage=100
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.shading.color_type='MATERIAL'
old=bpy.context.preferences.filepaths.save_version;bpy.context.preferences.filepaths.save_version=0
try:bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'skyplane-airport.blend'))
finally:bpy.context.preferences.filepaths.save_version=old
print('AIRPORT EXPORT', {name:len(faces) for name,faces in assets.items()})
