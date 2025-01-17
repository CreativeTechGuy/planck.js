/*
 * Planck.js
 * The MIT License
 * Copyright (c) 2021 Erin Catto, Ali Shakiba
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import type { MassData } from '../../dynamics/Body';
import { RayCastOutput, RayCastInput, AABB } from '../AABB';
import { DistanceProxy } from '../Distance';
import common from '../../util/common';
import { Transform } from '../../common/Transform';
import { Vec2 } from '../../common/Vec2';
import { Settings } from '../../Settings';
import { Shape } from '../Shape';
import { Edge } from './EdgeShape';
import { Rot } from '../../common/Rot';


const _ASSERT = typeof ASSERT === 'undefined' ? false : ASSERT;


/**
 * A chain shape is a free form sequence of line segments. The chain has
 * two-sided collision, so you can use inside and outside collision. Therefore,
 * you may use any winding order. Connectivity information is used to create
 * smooth collisions.
 *
 * WARNING: The chain will not collide properly if there are self-intersections.
 */
export class Chain extends Shape {
  m_vertices: Vec2[];
  m_count: number;
  m_prevVertex: Vec2 | null;
  m_nextVertex: Vec2 | null;
  m_hasPrevVertex: boolean;
  m_hasNextVertex: boolean;

  m_isLoop: boolean;

  constructor(vertices?: Vec2[], loop?: boolean) {
    super();

    this.m_type = "chain";
    this.m_radius = Settings.polygonRadius;
    this.m_vertices = [];
    this.m_count = 0;
    this.m_prevVertex = null;
    this.m_nextVertex = null;
    this.m_hasPrevVertex = false;
    this.m_hasNextVertex = false;

    this.m_isLoop = !!loop;

    if (vertices && vertices.length) {
      if (loop) {
        this._createLoop(vertices);
      } else {
        this._createChain(vertices);
      }
    }
  }

  // clear() {
  //   this.m_vertices.length = 0;
  //   this.m_count = 0;
  // }

  /**
   * @internal
   * Create a loop. This automatically adjusts connectivity.
   *
   * @param vertices an array of vertices, these are copied
   * @param count the vertex count
   */
  _createLoop(vertices: Vec2[]): Chain {
    _ASSERT && common.assert(this.m_vertices.length == 0 && this.m_count == 0);
    _ASSERT && common.assert(vertices.length >= 3);
    for (let i = 1; i < vertices.length; ++i) {
      const v1 = vertices[i - 1];
      const v2 = vertices[i];
      // If the code crashes here, it means your vertices are too close together.
      _ASSERT && common.assert(Vec2.distanceSquared(v1, v2) > Settings.linearSlopSquared);
    }

    this.m_vertices = [];
    this.m_count = vertices.length + 1;
    for (let i = 0; i < vertices.length; ++i) {
      this.m_vertices[i] = Vec2.clone(vertices[i]);
    }
    this.m_vertices[vertices.length] = Vec2.clone(vertices[0]);

    this.m_prevVertex = this.m_vertices[this.m_count - 2];
    this.m_nextVertex = this.m_vertices[1];
    this.m_hasPrevVertex = true;
    this.m_hasNextVertex = true;
    return this;
  }

  /**
   * @internal
   * Create a chain with isolated end vertices.
   *
   * @param vertices an array of vertices, these are copied
   * @param count the vertex count
   */
  _createChain(vertices: Vec2[]): Chain {
    _ASSERT && common.assert(this.m_vertices.length == 0 && this.m_count == 0);
    _ASSERT && common.assert(vertices.length >= 2);
    for (let i = 1; i < vertices.length; ++i) {
      // If the code crashes here, it means your vertices are too close together.
      const v1 = vertices[i - 1];
      const v2 = vertices[i];
      _ASSERT && common.assert(Vec2.distanceSquared(v1, v2) > Settings.linearSlopSquared);
    }

    this.m_count = vertices.length;
    for (let i = 0; i < vertices.length; ++i) {
      this.m_vertices[i] = Vec2.clone(vertices[i]);
    }

    this.m_hasPrevVertex = false;
    this.m_hasNextVertex = false;
    this.m_prevVertex = null;
    this.m_nextVertex = null;
    return this;
  }

  /** @internal */
  _reset(): void {
    if (this.m_isLoop) {
      this._createLoop(this.m_vertices);
    } else {
      this._createChain(this.m_vertices);
    }
  }

  /**
   * Establish connectivity to a vertex that precedes the first vertex. Don't call
   * this for loops.
   */
  setPrevVertex(prevVertex: Vec2): void {
    this.m_prevVertex = prevVertex;
    this.m_hasPrevVertex = true;
  }

  getPrevVertex(): Vec2 {
    return this.m_prevVertex;
  }

  /**
   * Establish connectivity to a vertex that follows the last vertex. Don't call
   * this for loops.
   */
  setNextVertex(nextVertex: Vec2): void {
    this.m_nextVertex = nextVertex;
    this.m_hasNextVertex = true;
  }

  getNextVertex(): Vec2 {
    return this.m_nextVertex;
  }

  /**
   * Get the number of child primitives.
   */
  getChildCount(): number {
    // edge count = vertex count - 1
    return this.m_count - 1;
  }

  // Get a child edge.
  getChildEdge(edge: Edge, childIndex: number): void {
    _ASSERT && common.assert(0 <= childIndex && childIndex < this.m_count - 1);
    edge.m_type = "edge";
    edge.m_radius = this.m_radius;

    edge.m_vertex1 = this.m_vertices[childIndex];
    edge.m_vertex2 = this.m_vertices[childIndex + 1];

    if (childIndex > 0) {
      edge.m_vertex0 = this.m_vertices[childIndex - 1];
      edge.m_hasVertex0 = true;
    } else {
      edge.m_vertex0 = this.m_prevVertex;
      edge.m_hasVertex0 = this.m_hasPrevVertex;
    }

    if (childIndex < this.m_count - 2) {
      edge.m_vertex3 = this.m_vertices[childIndex + 2];
      edge.m_hasVertex3 = true;
    } else {
      edge.m_vertex3 = this.m_nextVertex;
      edge.m_hasVertex3 = this.m_hasNextVertex;
    }
  }

  getVertex(index: number): Vec2 {
    _ASSERT && common.assert(0 <= index && index <= this.m_count);
    if (index < this.m_count) {
      return this.m_vertices[index];
    } else {
      return this.m_vertices[0];
    }
  }

  isLoop(): boolean {
    return this.m_isLoop;
  }

  /**
   * Test a point for containment in this shape. This only works for convex
   * shapes.
   *
   * This always return false.
   *
   * @param xf The shape world transform.
   * @param p A point in world coordinates.
   */
  testPoint(xf: Transform, p: Vec2): boolean {
    // https://stackoverflow.com/questions/42457842/calculate-if-point-coordinates-is-inside-polygon-with-concave-and-convex-angles
    let inside = false;
    const pLocal = Rot.mulTVec2(xf.q, Vec2.sub(p, xf.p));
    const x = pLocal.x;
    const y = pLocal.y;
    for (let i = 0; i < this.m_vertices.length - 1; i++) {
      const p1_x = this.m_vertices[i].x;
      const p1_y = this.m_vertices[i].y;
      const p2_x = this.m_vertices[i + 1].x;
      const p2_y = this.m_vertices[i + 1].y;
      // this edge is crossing the horizontal ray of testpoint
      if ((p1_y < y && p2_y >= y) || (p2_y < y && p1_y >= y)) {
        // checking special cases (holes, self-crossings, self-overlapping, horizontal edges, etc.)
        if (p1_x + ((y - p1_y) / (p2_y - p1_y)) * (p2_x - p1_x) < x) {
          inside = !inside;
        }
      }
    }
    return inside;
  }

  /**
   * Cast a ray against a child shape.
   *
   * @param output The ray-cast results.
   * @param input The ray-cast input parameters.
   * @param xf The transform to be applied to the shape.
   * @param childIndex The child shape index
   */
  rayCast(output: RayCastOutput, input: RayCastInput, xf: Transform, childIndex: number): boolean {
    _ASSERT && common.assert(0 <= childIndex && childIndex < this.m_count);

    const edgeShape = new Edge(this.getVertex(childIndex), this.getVertex(childIndex + 1));
    return edgeShape.rayCast(output, input, xf, 0);
  }

  /**
   * Given a transform, compute the associated axis aligned bounding box for a
   * child shape.
   *
   * @param aabb Returns the axis aligned box.
   * @param xf The world transform of the shape.
   * @param childIndex The child shape
   */
  computeAABB(aabb: AABB, xf: Transform, childIndex: number): void {
    _ASSERT && common.assert(0 <= childIndex && childIndex < this.m_count);

    const v1 = Transform.mulVec2(xf, this.getVertex(childIndex));
    const v2 = Transform.mulVec2(xf, this.getVertex(childIndex + 1));

    aabb.combinePoints(v1, v2);
  }

  /**
   * Compute the mass properties of this shape using its dimensions and density.
   * The inertia tensor is computed about the local origin.
   *
   * Chains have zero mass.
   *
   * @param massData Returns the mass data for this shape.
   * @param density The density in kilograms per meter squared.
   */
  computeMass(massData: MassData, density?: number): void {
    massData.mass = 0.0;
    massData.center = Vec2.zero();
    massData.I = 0.0;
  }

  computeDistanceProxy(proxy: DistanceProxy, childIndex: number): void {
    _ASSERT && common.assert(0 <= childIndex && childIndex < this.m_count);
    proxy.m_buffer[0] = this.getVertex(childIndex);
    proxy.m_buffer[1] = this.getVertex(childIndex + 1);
    proxy.m_vertices = proxy.m_buffer;
    proxy.m_count = 2;
    proxy.m_radius = this.m_radius;
  }
}
